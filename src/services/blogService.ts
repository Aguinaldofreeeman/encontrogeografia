import { DEFAULT_SEED_PHOTOS, DEFAULT_SETTINGS } from '../data/seedData';
import { supabase, emailToInviteId, isBootstrappedAdminEmail } from '../lib/supabase';
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

type DbPhoto = {
  id: string;
  category: PhotoCategory;
  title: string;
  caption: string | null;
  image_url: string;
  year_label: string | null;
  location: string | null;
  photographer: string | null;
  plate_code: string | null;
  featured: boolean | null;
  visibility: PhotoVisibility | null;
  author_uid: string | null;
  created_at: string | null;
};

type DbComment = {
  id: string;
  photo_id: string | null;
  target_type: CommentTargetType | null;
  author_name: string | null;
  author_relation: CommentRelation | null;
  text: string | null;
  status: CommentStatus | null;
  created_at: string | null;
};

function toMillis(iso: string | null | undefined): number {
  if (!iso) return Date.now();
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : Date.now();
}

function mapPhoto(row: DbPhoto): PhotoItem {
  return {
    id: row.id,
    category: row.category,
    title: row.title ?? '',
    caption: row.caption ?? '',
    imageUrl: row.image_url ?? '',
    yearLabel: row.year_label ?? '',
    location: row.location ?? '',
    photographer: row.photographer ?? '',
    plateCode: row.plate_code ?? undefined,
    featured: Boolean(row.featured),
    visibility: row.visibility ?? 'public',
    authorUid: row.author_uid ?? '',
    createdAtMs: toMillis(row.created_at),
  };
}

function mapComment(row: DbComment): CommentItem {
  return {
    id: row.id,
    photoId: row.photo_id ?? 'album',
    targetType: row.target_type ?? 'album',
    authorName: row.author_name ?? '',
    authorRelation: row.author_relation ?? 'Convidado',
    text: row.text ?? '',
    status: row.status ?? 'pending',
    createdAtMs: toMillis(row.created_at),
  };
}

function normalizeEmail(email?: string | null): string {
  return (email || '').trim().toLowerCase();
}

export async function checkIsAdminUser(
  uid: string,
  email: string | null,
  emailVerified: boolean,
  displayName?: string | null
): Promise<boolean> {
  if (!emailVerified) return false;
  const normalizedEmail = normalizeEmail(email);
  if (isBootstrappedAdminEmail(normalizedEmail)) return true;

  const { data: adminRow } = await supabase
    .from('admins')
    .select('uid')
    .eq('uid', uid)
    .maybeSingle();
  if (adminRow) return true;

  if (!normalizedEmail) return false;
  const inviteId = emailToInviteId(normalizedEmail);
  if (inviteId.length < 5) return false;

  const { data: invite } = await supabase
    .from('admin_invites')
    .select('email,display_name')
    .eq('id', inviteId)
    .maybeSingle();
  if (!invite) return false;

  const inviteEmail = normalizeEmail(invite.email);
  if (inviteEmail !== normalizedEmail) return false;

  // Self-claim admin row (RLS allows this for invited/bootstrap emails)
  await supabase.from('admins').upsert({
    uid,
    email: normalizedEmail,
    display_name: (invite.display_name || displayName || normalizedEmail).slice(0, 120),
    role: 'admin',
  });
  return true;
}

export async function listPhotos(isBootstrappedAdmin: boolean): Promise<PhotoItem[]> {
  let q = supabase.from('photos').select('*').order('created_at', { ascending: false });
  if (!isBootstrappedAdmin) q = q.eq('visibility', 'public');
  const { data, error } = await q;
  if (error) throw error;
  return (data as DbPhoto[]).map(mapPhoto);
}

export function subscribePhotos(
  isBootstrappedAdmin: boolean,
  onData: (photos: PhotoItem[], hasRemoteDocs: boolean) => void,
  onError: (err: Error) => void
): () => void {
  let active = true;
  const load = async () => {
    try {
      const items = await listPhotos(isBootstrappedAdmin);
      if (active) onData(items, items.length > 0);
    } catch (e) {
      if (active) onError(e instanceof Error ? e : new Error(String(e)));
    }
  };
  void load();

  const channel = supabase
    .channel(`photos-${isBootstrappedAdmin ? 'admin' : 'public'}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'photos' }, () => void load())
    .subscribe();

  return () => {
    active = false;
    void supabase.removeChannel(channel);
  };
}

export async function listComments(isBootstrappedAdmin: boolean): Promise<CommentItem[]> {
  let q = supabase.from('comments').select('*').order('created_at', { ascending: false });
  if (!isBootstrappedAdmin) q = q.eq('status', 'approved');
  const { data, error } = await q;
  if (error) throw error;
  return (data as DbComment[]).map(mapComment);
}

export function subscribeComments(
  isBootstrappedAdmin: boolean,
  onData: (comments: CommentItem[]) => void,
  onError: (err: Error) => void
): () => void {
  let active = true;
  const load = async () => {
    try {
      const items = await listComments(isBootstrappedAdmin);
      if (active) onData(items);
    } catch (e) {
      if (active) onError(e instanceof Error ? e : new Error(String(e)));
    }
  };
  void load();
  const channel = supabase
    .channel(`comments-${isBootstrappedAdmin ? 'admin' : 'public'}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => void load())
    .subscribe();
  return () => {
    active = false;
    void supabase.removeChannel(channel);
  };
}

function mergeGuideConfig(incoming: unknown, fallback: GuideTextConfig): GuideTextConfig {
  if (!incoming || typeof incoming !== 'object') return fallback;
  const g = incoming as Record<string, unknown>;
  return {
    romanIndex: typeof g.romanIndex === 'string' && g.romanIndex.trim() ? g.romanIndex : fallback.romanIndex,
    label: typeof g.label === 'string' && g.label.trim() ? g.label : fallback.label,
    shortLabel: typeof g.shortLabel === 'string' && g.shortLabel.trim() ? g.shortLabel : fallback.shortLabel,
    subtitle: typeof g.subtitle === 'string' && g.subtitle.trim() ? g.subtitle : fallback.subtitle,
    description: typeof g.description === 'string' && g.description.trim() ? g.description : fallback.description,
  };
}

function normalizeSettings(data: any): AlbumSettings {
  const rawGuides = (data?.guides && typeof data.guides === 'object' ? data.guides : {}) as Record<string, unknown>;
  return {
    brandName: String(data?.brandName ?? DEFAULT_SETTINGS.brandName),
    navCommentsLabel: String(data?.navCommentsLabel ?? DEFAULT_SETTINGS.navCommentsLabel),
    courseTitle: String(data?.courseTitle ?? DEFAULT_SETTINGS.courseTitle),
    degreeLabel: String(data?.degreeLabel ?? DEFAULT_SETTINGS.degreeLabel),
    classYear: String(data?.classYear ?? DEFAULT_SETTINGS.classYear),
    institution: String(data?.institution ?? DEFAULT_SETTINGS.institution),
    heroTitle: String(data?.heroTitle ?? DEFAULT_SETTINGS.heroTitle),
    introText: String(data?.introText ?? DEFAULT_SETTINGS.introText),
    heroPrimaryCta: typeof data?.heroPrimaryCta === 'string' ? data.heroPrimaryCta : '',
    heroSecondaryCta: String(data?.heroSecondaryCta ?? DEFAULT_SETTINGS.heroSecondaryCta),
    statPhotosLabel: String(data?.statPhotosLabel ?? DEFAULT_SETTINGS.statPhotosLabel),
    statGuidesLabel: String(data?.statGuidesLabel ?? DEFAULT_SETTINGS.statGuidesLabel),
    statCommentsLabel: String(data?.statCommentsLabel ?? DEFAULT_SETTINGS.statCommentsLabel),
    statInstitutionLabel: String(data?.statInstitutionLabel ?? DEFAULT_SETTINGS.statInstitutionLabel),
    statViewsLabel:
      typeof data?.statViewsLabel === 'string' && data.statViewsLabel.trim()
        ? data.statViewsLabel
        : DEFAULT_SETTINGS.statViewsLabel,
    searchPlaceholder: String(data?.searchPlaceholder ?? DEFAULT_SETTINGS.searchPlaceholder),
    commentsKicker: String(data?.commentsKicker ?? DEFAULT_SETTINGS.commentsKicker),
    commentsTitle: String(data?.commentsTitle ?? DEFAULT_SETTINGS.commentsTitle),
    commentsIntro: String(data?.commentsIntro ?? DEFAULT_SETTINGS.commentsIntro),
    shareTitle: String(data?.shareTitle ?? DEFAULT_SETTINGS.shareTitle),
    shareDescription: String(data?.shareDescription ?? DEFAULT_SETTINGS.shareDescription),
    commentFormTitle: String(data?.commentFormTitle ?? DEFAULT_SETTINGS.commentFormTitle),
    commentFormNotice: String(data?.commentFormNotice ?? DEFAULT_SETTINGS.commentFormNotice),
    footerNote: String(data?.footerNote ?? DEFAULT_SETTINGS.footerNote),
    guides: {
      historico: mergeGuideConfig(rawGuides.historico, DEFAULT_SETTINGS.guides.historico),
      formatura: mergeGuideConfig(rawGuides.formatura, DEFAULT_SETTINGS.guides.formatura),
      turma: mergeGuideConfig(rawGuides.turma, DEFAULT_SETTINGS.guides.turma),
    },
  };
}

export function subscribeAlbumSettings(
  onData: (settings: AlbumSettings) => void,
  onError: (err: Error) => void
): () => void {
  let active = true;
  const load = async () => {
    try {
      const { data, error } = await supabase.from('settings').select('data').eq('id', 'album').maybeSingle();
      if (error) throw error;
      if (active) onData(data?.data ? normalizeSettings(data.data) : DEFAULT_SETTINGS);
    } catch (e) {
      if (active) onError(e instanceof Error ? e : new Error(String(e)));
    }
  };
  void load();
  const channel = supabase
    .channel('settings-album')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: 'id=eq.album' }, () => void load())
    .subscribe();
  return () => {
    active = false;
    void supabase.removeChannel(channel);
  };
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

  if (title.length < VALIDATION_BOUNDS.photo.titleMin) throw new Error('Informe um título com pelo menos 2 caracteres.');
  if (!isAllowedImageUrl(imageUrl)) throw new Error('Forneça uma URL válida (https://) ou faça o upload de uma imagem.');
  if (yearLabel.length < VALIDATION_BOUNDS.photo.yearMin) throw new Error('Informe o ano ou período acadêmico.');
  if (location.length < VALIDATION_BOUNDS.photo.locationMin) throw new Error('Informe o local ou contexto geográfico da foto.');

  return { category: input.category, title, caption, imageUrl, yearLabel, location, photographer, featured: Boolean(input.featured), visibility: input.visibility };
}

function photoToDb(input: PhotoPayloadInput, authorUid: string) {
  const clean = validatePhotoPayload(input);
  return {
    category: clean.category,
    title: clean.title,
    caption: clean.caption,
    image_url: clean.imageUrl,
    year_label: clean.yearLabel,
    location: clean.location,
    photographer: clean.photographer,
    featured: clean.featured,
    visibility: clean.visibility,
    author_uid: authorUid,
  };
}

export async function createPhoto(authorUid: string, input: PhotoPayloadInput): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await supabase.from('photos').insert({ id, ...photoToDb(input, authorUid) });
  if (error) throw new Error(error.message);
  return id;
}

export async function updatePhoto(photoId: string, input: PhotoPayloadInput): Promise<void> {
  const clean = validatePhotoPayload(input);
  const { error } = await supabase.from('photos').update({
    category: clean.category,
    title: clean.title,
    caption: clean.caption,
    image_url: clean.imageUrl,
    year_label: clean.yearLabel,
    location: clean.location,
    photographer: clean.photographer,
    featured: clean.featured,
    visibility: clean.visibility,
  }).eq('id', photoId);
  if (error) throw new Error(error.message);
}

export async function saveSeedPhoto(
  authorUid: string,
  photoId: string,
  input: PhotoPayloadInput
): Promise<void> {
  const payload = { id: photoId, ...photoToDb(input, authorUid) };
  const { error } = await supabase.from('photos').upsert(payload, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

export async function deletePhoto(photoId: string): Promise<void> {
  const { error } = await supabase.from('photos').delete().eq('id', photoId);
  if (error) throw new Error(error.message);
}

export async function seedInitialAlbumIfEmpty(authorUid: string): Promise<void> {
  const rows = DEFAULT_SEED_PHOTOS.map((seed) => ({
    id: seed.id,
    category: seed.category,
    title: seed.title,
    caption: seed.caption,
    image_url: seed.imageUrl,
    year_label: seed.yearLabel,
    location: seed.location,
    photographer: seed.photographer,
    featured: seed.featured,
    visibility: seed.visibility,
    author_uid: authorUid,
  }));
  const { error } = await supabase.from('photos').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw new Error(error.message);
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
  if (authorName.length < VALIDATION_BOUNDS.comment.authorNameMin) throw new Error('Informe seu nome (mínimo 2 caracteres).');
  if (text.length < VALIDATION_BOUNDS.comment.textMin) throw new Error('Escreva uma mensagem com pelo menos 4 caracteres.');

  const { error } = await supabase.from('comments').insert({
    photo_id: input.targetType === 'album' ? 'album' : input.photoId,
    target_type: input.targetType,
    author_name: authorName,
    author_relation: input.authorRelation,
    text,
    status: 'pending',
  });
  if (error) throw new Error(error.message);
}

export async function moderateComment(commentId: string, status: CommentStatus): Promise<void> {
  const { error } = await supabase.from('comments').update({ status }).eq('id', commentId);
  if (error) throw new Error(error.message);
}

export async function updateCommentContent(
  commentId: string,
  input: { authorName: string; authorRelation: CommentRelation; text: string; status: CommentStatus }
): Promise<void> {
  const authorName = input.authorName.trim().slice(0, VALIDATION_BOUNDS.comment.authorNameMax);
  const text = input.text.trim().slice(0, VALIDATION_BOUNDS.comment.textMax);
  if (authorName.length < VALIDATION_BOUNDS.comment.authorNameMin) throw new Error('O nome do autor precisa ter pelo menos 2 caracteres.');
  if (text.length < VALIDATION_BOUNDS.comment.textMin) throw new Error('O texto do comentário precisa ter pelo menos 4 caracteres.');
  const { error } = await supabase.from('comments').update({
    author_name: authorName,
    author_relation: input.authorRelation,
    text,
    status: input.status,
  }).eq('id', commentId);
  if (error) throw new Error(error.message);
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('comments').delete().eq('id', commentId);
  if (error) throw new Error(error.message);
}

function sanitizeGuide(g: GuideTextConfig): GuideTextConfig {
  return {
    romanIndex: g.romanIndex.trim().slice(0, VALIDATION_BOUNDS.settings.guideRomanIndexMax),
    label: g.label.trim().slice(0, VALIDATION_BOUNDS.settings.guideLabelMax),
    shortLabel: g.shortLabel.trim().slice(0, VALIDATION_BOUNDS.settings.guideShortLabelMax),
    subtitle: g.subtitle.trim().slice(0, VALIDATION_BOUNDS.settings.guideSubtitleMax),
    description: g.description.trim().slice(0, VALIDATION_BOUNDS.settings.guideDescriptionMax),
  };
}

export async function saveAlbumSettings(authorUid: string, settings: AlbumSettings): Promise<void> {
  // Keep existing validation behavior by reusing bounds; keep payload shape as JSON.
  const payload: AlbumSettings = {
    ...settings,
    brandName: settings.brandName.trim().slice(0, VALIDATION_BOUNDS.settings.brandNameMax),
    navCommentsLabel: settings.navCommentsLabel.trim().slice(0, VALIDATION_BOUNDS.settings.navCommentsLabelMax),
    courseTitle: settings.courseTitle.trim().slice(0, VALIDATION_BOUNDS.settings.courseTitleMax),
    degreeLabel: settings.degreeLabel.trim().slice(0, VALIDATION_BOUNDS.settings.degreeLabelMax),
    classYear: settings.classYear.trim().slice(0, VALIDATION_BOUNDS.settings.classYearMax),
    institution: settings.institution.trim().slice(0, VALIDATION_BOUNDS.settings.institutionMax),
    heroTitle: settings.heroTitle.trim().slice(0, VALIDATION_BOUNDS.settings.heroTitleMax),
    introText: settings.introText.trim().slice(0, VALIDATION_BOUNDS.settings.introTextMax),
    heroPrimaryCta: (settings.heroPrimaryCta ?? '').trim().slice(0, VALIDATION_BOUNDS.settings.heroPrimaryCtaMax),
    heroSecondaryCta: settings.heroSecondaryCta.trim().slice(0, VALIDATION_BOUNDS.settings.heroSecondaryCtaMax),
    statPhotosLabel: settings.statPhotosLabel.trim().slice(0, VALIDATION_BOUNDS.settings.statLabelMax),
    statGuidesLabel: settings.statGuidesLabel.trim().slice(0, VALIDATION_BOUNDS.settings.statLabelMax),
    statCommentsLabel: settings.statCommentsLabel.trim().slice(0, VALIDATION_BOUNDS.settings.statLabelMax),
    statInstitutionLabel: settings.statInstitutionLabel.trim().slice(0, VALIDATION_BOUNDS.settings.statLabelMax),
    statViewsLabel: (settings.statViewsLabel ?? DEFAULT_SETTINGS.statViewsLabel ?? 'Visualizações').trim().slice(0, VALIDATION_BOUNDS.settings.statLabelMax),
    searchPlaceholder: settings.searchPlaceholder.trim().slice(0, VALIDATION_BOUNDS.settings.searchPlaceholderMax),
    commentsKicker: settings.commentsKicker.trim().slice(0, VALIDATION_BOUNDS.settings.commentsKickerMax),
    commentsTitle: settings.commentsTitle.trim().slice(0, VALIDATION_BOUNDS.settings.commentsTitleMax),
    commentsIntro: settings.commentsIntro.trim().slice(0, VALIDATION_BOUNDS.settings.commentsIntroMax),
    shareTitle: settings.shareTitle.trim().slice(0, VALIDATION_BOUNDS.settings.shareTitleMax),
    shareDescription: settings.shareDescription.trim().slice(0, VALIDATION_BOUNDS.settings.shareDescriptionMax),
    commentFormTitle: settings.commentFormTitle.trim().slice(0, VALIDATION_BOUNDS.settings.commentFormTitleMax),
    commentFormNotice: settings.commentFormNotice.trim().slice(0, VALIDATION_BOUNDS.settings.commentFormNoticeMax),
    footerNote: settings.footerNote.trim().slice(0, VALIDATION_BOUNDS.settings.footerNoteMax),
    guides: {
      historico: sanitizeGuide(settings.guides.historico),
      formatura: sanitizeGuide(settings.guides.formatura),
      turma: sanitizeGuide(settings.guides.turma),
    },
  };

  // Basic required validation (same spirit as before)
  const required = [
    payload.brandName, payload.navCommentsLabel, payload.courseTitle, payload.degreeLabel, payload.classYear,
    payload.institution, payload.heroTitle, payload.introText, payload.heroSecondaryCta,
    payload.statPhotosLabel, payload.statGuidesLabel, payload.statCommentsLabel, payload.statInstitutionLabel,
    payload.statViewsLabel || '', payload.searchPlaceholder, payload.commentsKicker, payload.commentsTitle,
    payload.commentsIntro, payload.shareTitle, payload.shareDescription, payload.commentFormTitle, payload.commentFormNotice,
  ];
  if (required.some((v) => !String(v).trim())) throw new Error('Preencha todos os campos obrigatórios de texto do blog corretamente.');
  for (const key of ['historico', 'formatura', 'turma'] as const) {
    const g = payload.guides[key];
    if ([g.romanIndex, g.label, g.shortLabel, g.subtitle, g.description].some((v) => !v.trim())) {
      throw new Error('Preencha todos os índices, títulos, subtítulos e descrições das três guias.');
    }
  }

  const { error } = await supabase.from('settings').upsert({
    id: 'album',
    data: payload,
    updated_by_uid: authorUid,
  }, { onConflict: 'id' });
  if (error) throw new Error(error.message);
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
  let active = true;
  const load = async () => {
    try {
      const { data, error } = await supabase.from('admins').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (active) onData((data || []).map((d: any) => ({
        uid: d.uid,
        email: d.email ?? '',
        displayName: d.display_name ?? '',
        role: 'admin',
        createdAtMs: toMillis(d.created_at),
      })));
    } catch (e) {
      if (active) onError(e instanceof Error ? e : new Error(String(e)));
    }
  };
  void load();
  const ch = supabase.channel('admins-sub').on('postgres_changes', { event: '*', schema: 'public', table: 'admins' }, () => void load()).subscribe();
  return () => { active = false; void supabase.removeChannel(ch); };
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
  let active = true;
  const load = async () => {
    try {
      const { data, error } = await supabase.from('admin_invites').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (active) onData((data || []).map((d: any) => ({
        id: d.id,
        email: d.email ?? '',
        displayName: d.display_name ?? '',
        role: 'admin',
        createdByUid: d.created_by_uid ?? '',
        createdAtMs: toMillis(d.created_at),
      })));
    } catch (e) {
      if (active) onError(e instanceof Error ? e : new Error(String(e)));
    }
  };
  void load();
  const ch = supabase.channel('admin-invites-sub').on('postgres_changes', { event: '*', schema: 'public', table: 'admin_invites' }, () => void load()).subscribe();
  return () => { active = false; void supabase.removeChannel(ch); };
}

export async function addAdminInvite(input: { email: string; displayName: string; createdByUid: string }): Promise<void> {
  const email = input.email.trim().toLowerCase().slice(0, 120);
  const displayName = input.displayName.trim().slice(0, 120);
  if (email.length < 5 || !email.includes('@') || !email.includes('.')) throw new Error('Informe um e-mail Google válido.');
  if (displayName.length < 1) throw new Error('Informe o nome do administrador.');
  const id = emailToInviteId(email);
  if (id.length < 5) throw new Error('O e-mail informado não possui um formato válido para convite.');
  const { error } = await supabase.from('admin_invites').upsert({
    id, email, display_name: displayName, role: 'admin', created_by_uid: input.createdByUid,
  }, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

export async function removeAdminInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.from('admin_invites').delete().eq('id', inviteId);
  if (error) throw new Error(error.message);
}

export async function removeAdminUser(uid: string, email?: string): Promise<void> {
  const { error } = await supabase.from('admins').delete().eq('uid', uid);
  if (error) throw new Error(error.message);
  if (email && email.trim()) {
    const inviteId = emailToInviteId(email);
    if (inviteId.length >= 5) await supabase.from('admin_invites').delete().eq('id', inviteId);
  }
}

let homeViewRecordedInMemory = false;
const HOME_VIEW_SESSION_KEY = 'atlas_home_view_recorded';

export function subscribeHomePageViews(onData: (totalViews: number) => void, onError: (err: Error) => void): () => void {
  let active = true;
  const load = async () => {
    try {
      const { data, error } = await supabase.from('stats').select('total_views').eq('id', 'album').maybeSingle();
      if (error) throw error;
      if (active) onData(Number(data?.total_views ?? 0));
    } catch (e) {
      if (active) onError(e instanceof Error ? e : new Error(String(e)));
    }
  };
  void load();
  const ch = supabase.channel('stats-album').on('postgres_changes', { event: '*', schema: 'public', table: 'stats', filter: 'id=eq.album' }, () => void load()).subscribe();
  return () => { active = false; void supabase.removeChannel(ch); };
}

export async function recordHomePageView(): Promise<number> {
  if (homeViewRecordedInMemory) return -1;
  try {
    if (window.sessionStorage.getItem(HOME_VIEW_SESSION_KEY) === '1') {
      homeViewRecordedInMemory = true;
      return -1;
    }
  } catch {
    // ignore
  }
  homeViewRecordedInMemory = true;
  const { data, error } = await supabase.rpc('increment_home_views');
  if (error) {
    homeViewRecordedInMemory = false;
    throw new Error(error.message);
  }
  try { window.sessionStorage.setItem(HOME_VIEW_SESSION_KEY, '1'); } catch {}
  return Number(data ?? 0);
}
