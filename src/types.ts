export type PhotoCategory = 'historico' | 'formatura' | 'turma';

export type PhotoVisibility = 'public' | 'draft';

export type CommentStatus = 'pending' | 'approved';

export type CommentRelation = 'Colega de Turma' | 'Familiar' | 'Docente' | 'Convidado';

export type CommentTargetType = 'photo' | 'album';

export interface PhotoItem {
  id: string;
  category: PhotoCategory;
  title: string;
  caption: string;
  imageUrl: string;
  yearLabel: string;
  location: string;
  photographer: string;
  plateCode?: string;
  featured: boolean;
  visibility: PhotoVisibility;
  authorUid: string;
  createdAtMs: number;
  isSeedPreview?: boolean;
}

export interface CommentItem {
  id: string;
  photoId: string;
  targetType: CommentTargetType;
  authorName: string;
  authorRelation: CommentRelation;
  text: string;
  status: CommentStatus;
  createdAtMs: number;
}

export interface GuideTextConfig {
  romanIndex: string;
  label: string;
  shortLabel: string;
  subtitle: string;
  description: string;
}

export interface AlbumSettings {
  brandName: string;
  navCommentsLabel: string;
  courseTitle: string;
  degreeLabel: string;
  classYear: string;
  institution: string;
  heroTitle: string;
  introText: string;
  heroPrimaryCta?: string;
  heroSecondaryCta: string;
  statPhotosLabel: string;
  statGuidesLabel: string;
  statCommentsLabel: string;
  statInstitutionLabel: string;
  statViewsLabel?: string;
  searchPlaceholder: string;
  commentsKicker: string;
  commentsTitle: string;
  commentsIntro: string;
  shareTitle: string;
  shareDescription: string;
  commentFormTitle: string;
  commentFormNotice: string;
  footerNote: string;
  guides: Record<PhotoCategory, GuideTextConfig>;
}

export interface AdminUserItem {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin';
  createdAtMs: number;
}

export interface AdminInviteItem {
  id: string;
  email: string;
  displayName: string;
  role: 'admin';
  createdByUid: string;
  createdAtMs: number;
}

export interface CategoryMeta extends GuideTextConfig {
  id: PhotoCategory;
}
