import { CommentRelation, PhotoCategory, PhotoVisibility } from '../types';

/**
 * Limites do upload de imagem.
 * `imageUrlMax` limita o valor salvo no banco (URL pública ou data URL temporária antes do upload).
 */
export const UPLOAD_BOUNDS = {
  maxDimension: 1600,
  targetBytes: 450_000,
  maxDataUrlChars: 2_400_000,
};

export const VALIDATION_BOUNDS = {
  idPattern: /^[a-zA-Z0-9_-]+$/,
  idMax: 128,
  photo: {
    categories: ['historico', 'formatura', 'turma', 'professores'] as readonly PhotoCategory[],
    visibilities: ['public', 'draft'] as readonly PhotoVisibility[],
    titleMin: 2,
    titleMax: 140,
    captionMin: 0,
    captionMax: 1200,
    imageUrlMin: 5,
    imageUrlMax: 750000,
    yearMin: 2,
    yearMax: 40,
    locationMin: 2,
    locationMax: 120,
    photographerMin: 0,
    photographerMax: 100,
    plateCodeMin: 0,
    plateCodeMax: 30,
  },
  comment: {
    relations: ['Colega de Turma', 'Familiar', 'Docente', 'Convidado'] as readonly CommentRelation[],
    authorNameMin: 2,
    authorNameMax: 80,
    textMin: 4,
    textMax: 800,
  },
  settings: {
    brandNameMin: 2,
    brandNameMax: 60,
    navCommentsLabelMin: 2,
    navCommentsLabelMax: 30,
    courseTitleMin: 3,
    courseTitleMax: 120,
    degreeLabelMin: 3,
    degreeLabelMax: 120,
    classYearMin: 2,
    classYearMax: 30,
    institutionMin: 2,
    institutionMax: 140,
    heroTitleMin: 4,
    heroTitleMax: 140,
    introTextMin: 10,
    introTextMax: 1000,
    heroPrimaryCtaMin: 0,
    heroPrimaryCtaMax: 40,
    heroSecondaryCtaMin: 2,
    heroSecondaryCtaMax: 40,
    statLabelMin: 2,
    statLabelMax: 50,
    searchPlaceholderMin: 2,
    searchPlaceholderMax: 80,
    commentsKickerMin: 2,
    commentsKickerMax: 80,
    commentsTitleMin: 3,
    commentsTitleMax: 120,
    commentsIntroMin: 5,
    commentsIntroMax: 500,
    shareTitleMin: 2,
    shareTitleMax: 80,
    shareDescriptionMin: 4,
    shareDescriptionMax: 300,
    commentFormTitleMin: 2,
    commentFormTitleMax: 100,
    commentFormNoticeMin: 2,
    commentFormNoticeMax: 160,
    footerNoteMax: 200,
    guideRomanIndexMin: 1,
    guideRomanIndexMax: 30,
    guideLabelMin: 2,
    guideLabelMax: 80,
    guideShortLabelMin: 2,
    guideShortLabelMax: 30,
    guideSubtitleMin: 2,
    guideSubtitleMax: 140,
    guideDescriptionMin: 4,
    guideDescriptionMax: 600,
  },
};

export function isAllowedImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed.length < VALIDATION_BOUNDS.photo.imageUrlMin || trimmed.length > VALIDATION_BOUNDS.photo.imageUrlMax) {
    return false;
  }
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/src/assets/') ||
    trimmed.startsWith('data:image/')
  );
}

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64);
  return cleaned || `reg-${Date.now()}`;
}

export interface CompressedImageResult {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
  format: 'webp' | 'jpeg';
}

function estimateDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] || '';
  return Math.ceil((base64.length * 3) / 4);
}

export async function compressImageFile(file: File): Promise<CompressedImageResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecione um arquivo de imagem válido (JPG, PNG ou WebP).');
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Não foi possível ler o arquivo selecionado.'));
    };
    reader.onerror = () => reject(new Error('Erro ao ler a imagem do dispositivo.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('Formato de imagem não suportado pelo navegador.'));
    element.src = dataUrl;
  });

  const maxDimension = UPLOAD_BOUNDS.maxDimension;
  let targetWidth = img.naturalWidth || img.width;
  let targetHeight = img.naturalHeight || img.height;

  if (targetWidth > maxDimension || targetHeight > maxDimension) {
    if (targetWidth >= targetHeight) {
      targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
      targetWidth = maxDimension;
    } else {
      targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
      targetHeight = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível processar a imagem no navegador.');
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const qualities = [0.82, 0.72, 0.62, 0.52, 0.42];
  let best: CompressedImageResult | null = null;

  const consider = (candidate: string, format: 'webp' | 'jpeg') => {
    if (!candidate.startsWith('data:image/')) return;
    const bytes = estimateDataUrlBytes(candidate);
    if (bytes > UPLOAD_BOUNDS.maxDataUrlChars) return;
    const next: CompressedImageResult = { dataUrl: candidate, width: targetWidth, height: targetHeight, bytes, format };
    if (!best || bytes < best.bytes) best = next;
  };

  for (const quality of qualities) {
    consider(canvas.toDataURL('image/webp', quality), 'webp');
    if (best && (best as CompressedImageResult).bytes <= UPLOAD_BOUNDS.targetBytes) return best;
  }
  // JPEG fallback only if WebP didn't hit target (handles rare browsers / alpha-flattened cases)
  for (const quality of qualities) {
    consider(canvas.toDataURL('image/jpeg', quality), 'jpeg');
    if (best && (best as CompressedImageResult).bytes <= UPLOAD_BOUNDS.targetBytes) return best;
  }

  if (best) return best as CompressedImageResult;
  throw new Error('A imagem excede o limite máximo após compressão. Utilize uma foto menor ou recorte antes de enviar.');
}
