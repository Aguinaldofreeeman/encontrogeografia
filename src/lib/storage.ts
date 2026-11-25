import { supabase } from './supabase';

export interface StorageUploadResult {
  path: string;
  url: string;
}

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'fotografia';
}

function extFromDataUrl(dataUrl: string): string {
  const match = /^data:image\/(jpeg|png|webp);base64,/i.exec(dataUrl);
  if (!match) return 'jpg';
  return match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  if (!res.ok) throw new Error('Não foi possível ler a imagem para upload.');
  return res.blob();
}

export async function uploadPhotoToStorage(
  dataUrl: string,
  meta: { category: string; title: string }
): Promise<StorageUploadResult> {
  const ext = extFromDataUrl(dataUrl);
  const blob = await dataUrlToBlob(dataUrl);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${sanitizeFileName(meta.title)}-${stamp}.${ext}`;
  const path = `${meta.category}/${fileName}`;

  const { error } = await supabase.storage.from('photos').upload(path, blob, {
    cacheControl: '31536000',
    upsert: false,
    contentType: blob.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
  });

  if (error) {
    throw new Error(error.message || 'Falha ao enviar imagem para o armazenamento.');
  }

  const { data } = supabase.storage.from('photos').getPublicUrl(path);
  return { path, url: data.publicUrl };
}
