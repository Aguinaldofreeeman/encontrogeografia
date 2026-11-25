import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { DEFAULT_SEED_PHOTOS, DEFAULT_SETTINGS } from '../data/seedData';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import { isAllowedImageUrl, VALIDATION_BOUNDS } from '../lib/validation';
import {
  AdminInviteItem,
  AdminUserItem,
  AlbumSettings,
  CommentItem,
  CommentRelation,
  CommentStatus,
  CommentTargetType,
  GuideTextConfig,
  PhotoCategory,
  PhotoItem,
  PhotoVisibility,
} from '../types';

function toMillis(ts: unknown): number {
  if (ts instanceof Timestamp) {
    return ts.toMillis();
  }
  if (ts && typeof ts === 'object' && 'seconds' in ts) {
    return Number((ts as { seconds: number }).seconds) * 1000;
  }
  return Date.now();
}

export function emailToInviteId(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, VALIDATION_BOUNDS.idMax);
}

export async function checkIsAdminUser(
  uid: string,
  email: string | null,
  emailVerified: boolean,
  displayName?: string | null
): Promise<boolean> {
  if (!emailVerified) return false;
  const normalizedEmail = email?.trim().toLowerCase() ?? '';
  if (normalizedEmail === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) return true;

  const adminPath = `admins/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    if (snap.exists()) {
      return true;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, adminPath);
  }

  if (!normalizedEmail) return false;
  const inviteId = emailToInviteId(normalizedEmail);
  if (inviteId.length < 5) return false;

  const invitePath = `adminInvites/${inviteId}`;
  try {
    const inviteSnap = await getDoc(doc(db, 'adminInvites', inviteId));
    if (!inviteSnap.exists()) {
      return false;
    }
    const inviteData = inviteSnap.data();
    if (String(inviteData.email ?? '').trim().toLowerCase() !== normalizedEmail) {
      return false;
    }

    const resolvedName =
      (typeof inviteData.displayName === 'string' && inviteData.displayName.trim()) ||
      displayName?.trim() ||
      normalizedEmail;

    await setDoc(doc(db, 'admins', uid), {
      email: normalizedEmail.slice(0, 160),
      displayName: resolvedName.slice(0, 120),
      role: 'admin',
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, invitePath);
  }
}

export function subscribePhotos(
  isBootstrappedAdmin: boolean,
  onData: (photos: PhotoItem[], hasRemoteDocs: boolean) => void,
  onError: (err: Error) => void
): () => void {
  const path = 'photos';
  const ref = isBootstrappedAdmin
    ? collection(db, path)
    : query(collection(db, path), where('visibility', '==', 'public'));

  return onSnapshot(
    ref,
    (snapshot) => {
      const items: PhotoItem[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          category: (data.category as PhotoCategory) || 'historico',
          title: String(data.title ?? ''),
          caption: String(data.caption ?? ''),
          imageUrl: String(data.imageUrl ?? ''),
          yearLabel: String(data.yearLabel ?? ''),
          location: String(data.location ?? ''),
          photographer: String(data.photographer ?? ''),
          plateCode: data.plateCode ? String(data.plateCode) : undefined,
          featured: Boolean(data.featured),
          visibility: (data.visibility as PhotoVisibility) || 'public',
          authorUid: String(data.authorUid ?? ''),
          createdAtMs: toMillis(data.createdAt),
        };
      });

      items.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(items, snapshot.docs.length > 0);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeComments(
  isBootstrappedAdmin: boolean,
  onData: (comments: CommentItem[]) => void,
  onError: (err: Error) => void
): () => void {
  const path = 'comments';
  const ref = isBootstrappedAdmin
    ? collection(db, path)
    : query(collection(db, path), where('status', '==', 'approved'));

  return onSnapshot(
    ref,
    (snapshot) => {
      const items: CommentItem[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          photoId: String(data.photoId ?? 'album'),
          targetType: (data.targetType as CommentTargetType) || 'album',
          authorName: String(data.authorName ?? ''),
          authorRelation: (data.authorRelation as CommentRelation) || 'Convidado',
          text: String(data.text ?? ''),
          status: (data.status as CommentStatus) || 'pending',
          createdAtMs: toMillis(data.createdAt),
        };
      });

      items.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

function mergeGuideConfig(
  incoming: unknown,
  fallback: GuideTextConfig
): GuideTextConfig {
  if (!incoming || typeof incoming !== 'object') return fallback;
  const g = incoming as Record<string, unknown>;
  return {
    romanIndex:
      typeof g.romanIndex === 'string' && g.romanIndex.trim()
        ? g.romanIndex
        : fallback.romanIndex,
    label: typeof g.label === 'string' && g.label.trim() ? g.label : fallback.label,
    shortLabel:
      typeof g.shortLabel === 'string' && g.shortLabel.trim()
        ? g.shortLabel
        : fallback.shortLabel,
    subtitle:
      typeof g.subtitle === 'string' && g.subtitle.trim() ? g.subtitle : fallback.subtitle,
    description:
      typeof g.description === 'string' && g.description.trim()
        ? g.description
        : fallback.description,
  };
}

export function subscribeAlbumSettings(
  onData: (settings: AlbumSettings) => void,
  onError: (err: Error) => void
): () => void {
  const path = 'settings/album';
  return onSnapshot(
    doc(db, 'settings', 'album'),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(DEFAULT_SETTINGS);
        return;
      }
      const data = snapshot.data();
      const rawGuides = (data.guides && typeof data.guides === 'object' ? data.guides : {}) as Record<
        string,
        unknown
      >;
      onData({
        brandName: String(data.brandName ?? DEFAULT_SETTINGS.brandName),
        navCommentsLabel: String(data.navCommentsLabel ?? DEFAULT_SETTINGS.navCommentsLabel),
        courseTitle: String(data.courseTitle ?? DEFAULT_SETTINGS.courseTitle),
        degreeLabel: String(data.degreeLabel ?? DEFAULT_SETTINGS.degreeLabel),
        classYear: String(data.classYear ?? DEFAULT_SETTINGS.classYear),
        institution: String(data.institution ?? DEFAULT_SETTINGS.institution),
        heroTitle: String(data.heroTitle ?? DEFAULT_SETTINGS.heroTitle),
        introText: String(data.introText ?? DEFAULT_SETTINGS.introText),
        heroPrimaryCta:
          typeof data.heroPrimaryCta === 'string' ? data.heroPrimaryCta : '',
        heroSecondaryCta: String(data.heroSecondaryCta ?? DEFAULT_SETTINGS.heroSecondaryCta),
        statPhotosLabel: String(data.statPhotosLabel ?? DEFAULT_SETTINGS.statPhotosLabel),
        statGuidesLabel: String(data.statGuidesLabel ?? DEFAULT_SETTINGS.statGuidesLabel),
        statCommentsLabel: String(data.statCommentsLabel ?? DEFAULT_SETTINGS.statCommentsLabel),
        statInstitutionLabel: String(
          data.statInstitutionLabel ?? DEFAULT_SETTINGS.statInstitutionLabel
        ),
        statViewsLabel:
          typeof data.statViewsLabel === 'string' && data.statViewsLabel.trim()
            ? data.statViewsLabel
            : DEFAULT_SETTINGS.statViewsLabel,
        searchPlaceholder: String(data.searchPlaceholder ?? DEFAULT_SETTINGS.searchPlaceholder),
        commentsKicker: String(data.commentsKicker ?? DEFAULT_SETTINGS.commentsKicker),
        commentsTitle: String(data.commentsTitle ?? DEFAULT_SETTINGS.commentsTitle),
        commentsIntro: String(data.commentsIntro ?? DEFAULT_SETTINGS.commentsIntro),
        shareTitle: String(data.shareTitle ?? DEFAULT_SETTINGS.shareTitle),
        shareDescription: String(data.shareDescription ?? DEFAULT_SETTINGS.shareDescription),
        commentFormTitle: String(data.commentFormTitle ?? DEFAULT_SETTINGS.commentFormTitle),
        commentFormNotice: String(data.commentFormNotice ?? DEFAULT_SETTINGS.commentFormNotice),
        footerNote: String(data.footerNote ?? DEFAULT_SETTINGS.footerNote),
        guides: {
          historico: mergeGuideConfig(rawGuides.historico, DEFAULT_SETTINGS.guides.historico),
          formatura: mergeGuideConfig(rawGuides.formatura, DEFAULT_SETTINGS.guides.formatura),
          turma: mergeGuideConfig(rawGuides.turma, DEFAULT_SETTINGS.guides.turma),
        },
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export interface PhotoPayloadInput {
  category: PhotoCategory;
  title: string;
  caption: string;
  imageUrl: string;
  yearLabel: string;
  location: string;
  photographer: string;
  featured: boolean;
  visibility: PhotoVisibility;
}

function validatePhotoPayload(input: PhotoPayloadInput): PhotoPayloadInput {
  const title = input.title.trim().slice(0, VALIDATION_BOUNDS.photo.titleMax);
  const caption = input.caption.trim().slice(0, VALIDATION_BOUNDS.photo.captionMax);
  const imageUrl = input.imageUrl.trim();
  const yearLabel = input.yearLabel.trim().slice(0, VALIDATION_BOUNDS.photo.yearMax);
  const location = input.location.trim().slice(0, VALIDATION_BOUNDS.photo.locationMax);
  const photographer = input.photographer.trim().slice(0, VALIDATION_BOUNDS.photo.photographerMax);

  if (title.length < VALIDATION_BOUNDS.photo.titleMin) {
    throw new Error('Informe um título com pelo menos 2 caracteres.');
  }
  if (!isAllowedImageUrl(imageUrl)) {
    throw new Error('Forneça uma URL válida (https://) ou faça o upload de uma imagem.');
  }
  if (yearLabel.length < VALIDATION_BOUNDS.photo.yearMin) {
    throw new Error('Informe o ano ou período acadêmico.');
  }
  if (location.length < VALIDATION_BOUNDS.photo.locationMin) {
    throw new Error('Informe o local ou contexto geográfico da foto.');
  }

  return {
    category: input.category,
    title,
    caption,
    imageUrl,
    yearLabel,
    location,
    photographer,
    featured: Boolean(input.featured),
    visibility: input.visibility,
  };
}

export async function createPhoto(authorUid: string, input: PhotoPayloadInput): Promise<string> {
  const clean = validatePhotoPayload(input);
  const colRef = collection(db, 'photos');
  const newDocRef = doc(colRef);
  const path = `photos/${newDocRef.id}`;

  try {
    await setDoc(newDocRef, {
      ...clean,
      authorUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return newDocRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updatePhoto(photoId: string, input: PhotoPayloadInput): Promise<void> {
  const clean = validatePhotoPayload(input);
  const path = `photos/${photoId}`;
  try {
    await updateDoc(doc(db, 'photos', photoId), {
      ...clean,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveSeedPhotoToFirestore(
  authorUid: string,
  photoId: string,
  input: PhotoPayloadInput
): Promise<void> {
  const clean = validatePhotoPayload(input);
  const path = `photos/${photoId}`;
  const ref = doc(db, 'photos', photoId);
  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      await updateDoc(ref, {
        ...clean,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ...clean,
        authorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deletePhoto(photoId: string): Promise<void> {
  const path = `photos/${photoId}`;
  try {
    await deleteDoc(doc(db, 'photos', photoId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function seedInitialAlbumIfEmpty(authorUid: string): Promise<void> {
  const batch = writeBatch(db);
  for (const seed of DEFAULT_SEED_PHOTOS) {
    const ref = doc(db, 'photos', seed.id);
    batch.set(ref, {
      category: seed.category,
      title: seed.title,
      caption: seed.caption,
      imageUrl: seed.imageUrl,
      yearLabel: seed.yearLabel,
      location: seed.location,
      photographer: seed.photographer,
      featured: seed.featured,
      visibility: seed.visibility,
      authorUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  const settingsRef = doc(db, 'settings', 'album');
  batch.set(settingsRef, {
    ...DEFAULT_SETTINGS,
    updatedByUid: authorUid,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'photos/seed');
  }
}

export async function submitComment(input: {
  photoId: string;
  targetType: CommentTargetType;
  authorName: string;
  authorRelation: CommentRelation;
  text: string;
}): Promise<void> {
  const authorName = input.authorName.trim().slice(0, VALIDATION_BOUNDS.comment.authorNameMax);
  const text = input.text.trim().slice(0, VALIDATION_BOUNDS.comment.textMax);

  if (authorName.length < VALIDATION_BOUNDS.comment.authorNameMin) {
    throw new Error('Informe seu nome (mínimo 2 caracteres).');
  }
  if (text.length < VALIDATION_BOUNDS.comment.textMin) {
    throw new Error('Escreva uma mensagem com pelo menos 4 caracteres.');
  }

  const colRef = collection(db, 'comments');
  const newDocRef = doc(colRef);
  const path = `comments/${newDocRef.id}`;

  try {
    await setDoc(newDocRef, {
      photoId: input.targetType === 'album' ? 'album' : input.photoId,
      targetType: input.targetType,
      authorName,
      authorRelation: input.authorRelation,
      text,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function moderateComment(commentId: string, status: CommentStatus): Promise<void> {
  const path = `comments/${commentId}`;
  try {
    await updateDoc(doc(db, 'comments', commentId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateCommentContent(
  commentId: string,
  input: {
    authorName: string;
    authorRelation: CommentRelation;
    text: string;
    status: CommentStatus;
  }
): Promise<void> {
  const authorName = input.authorName.trim().slice(0, VALIDATION_BOUNDS.comment.authorNameMax);
  const text = input.text.trim().slice(0, VALIDATION_BOUNDS.comment.textMax);

  if (authorName.length < VALIDATION_BOUNDS.comment.authorNameMin) {
    throw new Error('O nome do autor precisa ter pelo menos 2 caracteres.');
  }
  if (text.length < VALIDATION_BOUNDS.comment.textMin) {
    throw new Error('O texto do comentário precisa ter pelo menos 4 caracteres.');
  }

  const path = `comments/${commentId}`;
  try {
    await updateDoc(doc(db, 'comments', commentId), {
      authorName,
      authorRelation: input.authorRelation,
      text,
      status: input.status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteComment(commentId: string): Promise<void> {
  const path = `comments/${commentId}`;
  try {
    await deleteDoc(doc(db, 'comments', commentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveAlbumSettings(authorUid: string, settings: AlbumSettings): Promise<void> {
  const brandName = settings.brandName.trim().slice(0, VALIDATION_BOUNDS.settings.brandNameMax);
  const navCommentsLabel = settings.navCommentsLabel
    .trim()
    .slice(0, VALIDATION_BOUNDS.settings.navCommentsLabelMax);
  const courseTitle = settings.courseTitle.trim().slice(0, VALIDATION_BOUNDS.settings.courseTitleMax);
  const degreeLabel = settings.degreeLabel.trim().slice(0, VALIDATION_BOUNDS.settings.degreeLabelMax);
  const classYear = settings.classYear.trim().slice(0, VALIDATION_BOUNDS.settings.classYearMax);
  const institution = settings.institution.trim().slice(0, VALIDATION_BOUNDS.settings.institutionMax);
  const heroTitle = settings.heroTitle.trim().slice(0, VALIDATION_BOUNDS.settings.heroTitleMax);
  const introText = settings.introText.trim().slice(0, VALIDATION_BOUNDS.settings.introTextMax);
  const heroPrimaryCta = (settings.heroPrimaryCta ?? '')
    .trim()
    .slice(0, VALIDATION_BOUNDS.settings.heroPrimaryCtaMax);
  const heroSecondaryCta = settings.heroSecondaryCta
    .trim()
    .slice(0, VALIDATION_BOUNDS.settings.heroSecondaryCtaMax);
  const statPhotosLabel = settings.statPhotosLabel
    .trim()
    .slice(0, VALIDATION_BOUNDS.settings.statLabelMax);
  const statGuidesLabel = settings.statGuidesLabel
    .trim()
    .slice(0, VALIDATION_BOUNDS.settings.statLabelMax);
  const statCommentsLabel = settings.statCommentsLabel
    .trim()
    .slice(0, VALIDATION_BOUNDS.settings.statLabelMax);
  const statInstitutionLabel = settings.statInstitutionLabel
    .trim()
    .slice(0, VALIDATION_BOUNDS.settings.statLabelMax);
  const statViewsLabel = (settings.statViewsLabel ?? DEFAULT_SETTINGS.statViewsLabel ?? 'Visualizações')
    .trim()
    .slice(0, VALIDATION_BOUNDS.settings.statLabelMax);
  const searchPlaceholder = settings.searchPlaceholder
    .trim()
    .slice(0, VALIDATION_BOUNDS.settings.searchPlaceholderMax);
  const commentsKicker = settings.commentsKicker
    .trim()
    .slice(0, VALIDATION_BOUNDS.settings.commentsKickerMax);
  const commentsTitle = settings.commentsTitle
    .trim()
    .slice(0, VALIDATION_BOUNDS.settings.commentsTitleMax);
  const commentsIntro = settings.commentsIntro
    .trim()
    .slice(0, VALIDATION_BOUNDS.settings.commentsIntroMax);
  const shareTitle = settings.shareTitle
    .trim()
    .slice(0, VALIDATION_BOUNDS.settings.shareTitleMax);
  const shareDescription = settings.shareDescription
    .trim()
    .slice(0, VALIDATION_BOUNDS.settings.shareDescriptionMax);
  const commentFormTitle = settings.commentFormTitle
    .trim()
    .slice(0, VALIDATION_BOUNDS.settings.commentFormTitleMax);
  const commentFormNotice = settings.commentFormNotice
    .trim()
    .slice(0, VALIDATION_BOUNDS.settings.commentFormNoticeMax);
  const footerNote = settings.footerNote
    .trim()
    .slice(0, VALIDATION_BOUNDS.settings.footerNoteMax);

  const sanitizeGuide = (g: GuideTextConfig): GuideTextConfig => ({
    romanIndex: g.romanIndex.trim().slice(0, VALIDATION_BOUNDS.settings.guideRomanIndexMax),
    label: g.label.trim().slice(0, VALIDATION_BOUNDS.settings.guideLabelMax),
    shortLabel: g.shortLabel.trim().slice(0, VALIDATION_BOUNDS.settings.guideShortLabelMax),
    subtitle: g.subtitle.trim().slice(0, VALIDATION_BOUNDS.settings.guideSubtitleMax),
    description: g.description.trim().slice(0, VALIDATION_BOUNDS.settings.guideDescriptionMax),
  });

  const guides = {
    historico: sanitizeGuide(settings.guides.historico),
    formatura: sanitizeGuide(settings.guides.formatura),
    turma: sanitizeGuide(settings.guides.turma),
  };

  if (
    brandName.length < VALIDATION_BOUNDS.settings.brandNameMin ||
    navCommentsLabel.length < VALIDATION_BOUNDS.settings.navCommentsLabelMin ||
    courseTitle.length < VALIDATION_BOUNDS.settings.courseTitleMin ||
    degreeLabel.length < VALIDATION_BOUNDS.settings.degreeLabelMin ||
    classYear.length < VALIDATION_BOUNDS.settings.classYearMin ||
    institution.length < VALIDATION_BOUNDS.settings.institutionMin ||
    heroTitle.length < VALIDATION_BOUNDS.settings.heroTitleMin ||
    introText.length < VALIDATION_BOUNDS.settings.introTextMin ||
    heroSecondaryCta.length < VALIDATION_BOUNDS.settings.heroSecondaryCtaMin ||
    statPhotosLabel.length < VALIDATION_BOUNDS.settings.statLabelMin ||
    statGuidesLabel.length < VALIDATION_BOUNDS.settings.statLabelMin ||
    statCommentsLabel.length < VALIDATION_BOUNDS.settings.statLabelMin ||
    statInstitutionLabel.length < VALIDATION_BOUNDS.settings.statLabelMin ||
    statViewsLabel.length < VALIDATION_BOUNDS.settings.statLabelMin ||
    searchPlaceholder.length < VALIDATION_BOUNDS.settings.searchPlaceholderMin ||
    commentsKicker.length < VALIDATION_BOUNDS.settings.commentsKickerMin ||
    commentsTitle.length < VALIDATION_BOUNDS.settings.commentsTitleMin ||
    commentsIntro.length < VALIDATION_BOUNDS.settings.commentsIntroMin ||
    shareTitle.length < VALIDATION_BOUNDS.settings.shareTitleMin ||
    shareDescription.length < VALIDATION_BOUNDS.settings.shareDescriptionMin ||
    commentFormTitle.length < VALIDATION_BOUNDS.settings.commentFormTitleMin ||
    commentFormNotice.length < VALIDATION_BOUNDS.settings.commentFormNoticeMin
  ) {
    throw new Error('Preencha todos os campos obrigatórios de texto do blog corretamente.');
  }

  for (const key of ['historico', 'formatura', 'turma'] as const) {
    const g = guides[key];
    if (
      g.romanIndex.length < VALIDATION_BOUNDS.settings.guideRomanIndexMin ||
      g.label.length < VALIDATION_BOUNDS.settings.guideLabelMin ||
      g.shortLabel.length < VALIDATION_BOUNDS.settings.guideShortLabelMin ||
      g.subtitle.length < VALIDATION_BOUNDS.settings.guideSubtitleMin ||
      g.description.length < VALIDATION_BOUNDS.settings.guideDescriptionMin
    ) {
      throw new Error('Preencha todos os índices, títulos, subtítulos e descrições das três guias.');
    }
  }

  const path = 'settings/album';
  try {
    await setDoc(doc(db, 'settings', 'album'), {
      brandName,
      navCommentsLabel,
      courseTitle,
      degreeLabel,
      classYear,
      institution,
      heroTitle,
      introText,
      heroPrimaryCta,
      heroSecondaryCta,
      statPhotosLabel,
      statGuidesLabel,
      statCommentsLabel,
      statInstitutionLabel,
      statViewsLabel,
      searchPlaceholder,
      commentsKicker,
      commentsTitle,
      commentsIntro,
      shareTitle,
      shareDescription,
      commentFormTitle,
      commentFormNotice,
      footerNote,
      guides,
      updatedByUid: authorUid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeAdmins(
  enabled: boolean,
  onData: (admins: AdminUserItem[]) => void,
  onError: (err: Error) => void
): () => void {
  if (!enabled) {
    onData([]);
    return () => {};
  }
  const path = 'admins';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list: AdminUserItem[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          email: String(data.email ?? ''),
          displayName: String(data.displayName ?? ''),
          role: 'admin',
          createdAtMs: toMillis(data.createdAt),
        };
      });
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function addAdminUser(input: {
  uid: string;
  email: string;
  displayName: string;
}): Promise<void> {
  const uid = input.uid.trim();
  const email = input.email.trim().slice(0, 160);
  const displayName = input.displayName.trim().slice(0, 120);

  if (!VALIDATION_BOUNDS.idPattern.test(uid) || uid.length > VALIDATION_BOUNDS.idMax) {
    throw new Error('Informe um UID válido do Firebase Auth (apenas letras, números, _ ou -).');
  }
  if (email.length < 5 || !email.includes('@')) {
    throw new Error('Informe um e-mail Google válido.');
  }
  if (displayName.length < 1) {
    throw new Error('Informe o nome do administrador.');
  }

  const path = `admins/${uid}`;
  try {
    await setDoc(doc(db, 'admins', uid), {
      email,
      displayName,
      role: 'admin',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function removeAdminUser(uid: string, email?: string): Promise<void> {
  const path = `admins/${uid}`;
  try {
    await deleteDoc(doc(db, 'admins', uid));
    if (email && email.trim()) {
      const inviteId = emailToInviteId(email);
      if (inviteId.length >= 5) {
        await deleteDoc(doc(db, 'adminInvites', inviteId));
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeAdminInvites(
  enabled: boolean,
  onData: (invites: AdminInviteItem[]) => void,
  onError: (err: Error) => void
): () => void {
  if (!enabled) {
    onData([]);
    return () => {};
  }
  const path = 'adminInvites';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list: AdminInviteItem[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          email: String(data.email ?? ''),
          displayName: String(data.displayName ?? ''),
          role: 'admin',
          createdByUid: String(data.createdByUid ?? ''),
          createdAtMs: toMillis(data.createdAt),
        };
      });
      list.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function addAdminInvite(input: {
  email: string;
  displayName: string;
  createdByUid: string;
}): Promise<void> {
  const email = input.email.trim().toLowerCase().slice(0, 120);
  const displayName = input.displayName.trim().slice(0, 120);

  if (email.length < 5 || !email.includes('@') || !email.includes('.')) {
    throw new Error('Informe um e-mail Google válido.');
  }
  if (displayName.length < 1) {
    throw new Error('Informe o nome do administrador.');
  }

  const inviteId = emailToInviteId(email);
  if (!VALIDATION_BOUNDS.idPattern.test(inviteId) || inviteId.length < 5 || inviteId.length > VALIDATION_BOUNDS.idMax) {
    throw new Error('O e-mail informado não possui um formato válido para convite.');
  }

  const path = `adminInvites/${inviteId}`;
  try {
    await setDoc(doc(db, 'adminInvites', inviteId), {
      email,
      displayName,
      role: 'admin',
      createdByUid: input.createdByUid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function removeAdminInvite(inviteId: string): Promise<void> {
  const path = `adminInvites/${inviteId}`;
  try {
    await deleteDoc(doc(db, 'adminInvites', inviteId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

let homeViewRecordedInMemory = false;
const HOME_VIEW_SESSION_KEY = 'atlas_home_view_recorded';

export function subscribeHomePageViews(
  onData: (totalViews: number) => void,
  onError: (err: Error) => void
): () => void {
  const path = 'stats/album';
  return onSnapshot(
    doc(db, 'stats', 'album'),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(0);
        return;
      }
      const raw = snapshot.data().totalViews;
      onData(typeof raw === 'number' && Number.isFinite(raw) ? raw : 0);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function recordHomePageView(): Promise<number> {
  if (homeViewRecordedInMemory) {
    return -1;
  }
  try {
    if (window.sessionStorage.getItem(HOME_VIEW_SESSION_KEY) === '1') {
      homeViewRecordedInMemory = true;
      return -1;
    }
  } catch {
    // Ignore storage access errors in restricted iframes
  }

  homeViewRecordedInMemory = true;
  const statsRef = doc(db, 'stats', 'album');
  const path = 'stats/album';

  try {
    const nextViews = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(statsRef);
      if (!snap.exists()) {
        transaction.set(statsRef, {
          totalViews: 1,
          updatedAt: serverTimestamp(),
        });
        return 1;
      }
      const current = Number(snap.data().totalViews ?? 0);
      const updated = (Number.isFinite(current) && current >= 0 ? Math.floor(current) : 0) + 1;
      transaction.update(statsRef, {
        totalViews: updated,
        updatedAt: serverTimestamp(),
      });
      return updated;
    });

    try {
      window.sessionStorage.setItem(HOME_VIEW_SESSION_KEY, '1');
    } catch {
      // Ignore storage access errors
    }
    return nextViews;
  } catch (error) {
    homeViewRecordedInMemory = false;
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}


