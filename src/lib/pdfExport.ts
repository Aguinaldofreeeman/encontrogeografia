import { jsPDF } from 'jspdf';
import { CATEGORY_META } from '../data/seedData';
import { AlbumSettings, PhotoCategory, PhotoItem } from '../types';

const CATEGORY_SEQUENCE: PhotoCategory[] = ['historico', 'formatura', 'turma'];

interface LoadedImage {
  dataUrl: string;
  width: number;
  height: number;
}

async function loadImageForPdf(url: string): Promise<LoadedImage | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (url.startsWith('http://') || url.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }

    const timer = window.setTimeout(() => resolve(null), 8000);

    img.onload = () => {
      window.clearTimeout(timer);
      try {
        const rawW = img.naturalWidth || img.width || 1200;
        const rawH = img.naturalHeight || img.height || 900;
        const maxSide = 1600;
        let targetW = rawW;
        let targetH = rawH;

        if (targetW > maxSide || targetH > maxSide) {
          if (targetW >= targetH) {
            targetH = Math.round((targetH * maxSide) / targetW);
            targetW = maxSide;
          } else {
            targetW = Math.round((targetW * maxSide) / targetH);
            targetH = maxSide;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        resolve({ dataUrl, width: targetW, height: targetH });
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };

    img.src = url;
  });
}

function drawPageBackdrop(doc: jsPDF, pageW: number, pageH: number) {
  doc.setFillColor(249, 247, 241); // #F9F7F1 archival paper
  doc.rect(0, 0, pageW, pageH, 'F');

  doc.setDrawColor(221, 214, 197); // #DDD6C5 hairline border
  doc.setLineWidth(0.35);
  doc.rect(10, 10, pageW - 20, pageH - 20);
}

function buildSafeFilename(settings: AlbumSettings): string {
  const base = `${settings.courseTitle}-${settings.classYear}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `album-formatura-${base || 'geografia'}.pdf`;
}

export async function exportAlbumToPdf(
  publicPhotos: PhotoItem[],
  settings: AlbumSettings
): Promise<number> {
  if (publicPhotos.length === 0) {
    throw new Error('Não há fotografias públicas disponíveis para exportar.');
  }

  // Order photos by editorial guide sequence
  const orderedPhotos: PhotoItem[] = [];
  for (const cat of CATEGORY_SEQUENCE) {
    const items = publicPhotos.filter((p) => p.category === cat);
    orderedPhotos.push(...items);
  }

  // Preload all images in parallel
  const loadedImages = await Promise.all(
    orderedPhotos.map((photo) => loadImageForPdf(photo.imageUrl))
  );

  const coverIndex = orderedPhotos.findIndex((p) => p.featured);
  const coverPhotoIndex = coverIndex >= 0 ? coverIndex : 0;
  const coverPhoto = orderedPhotos[coverPhotoIndex];
  const coverImage = loadedImages[coverPhotoIndex];

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageW = doc.internal.pageSize.getWidth(); // 210mm
  const pageH = doc.internal.pageSize.getHeight(); // 297mm
  const totalPages = 1 + orderedPhotos.length;

  // =========================================================
  // PAGE 1: COVER (CAPA EDITORIAL DO ÁLBUM DE FORMATURA)
  // =========================================================
  drawPageBackdrop(doc, pageW, pageH);

  // Inner forest-green editorial frame on cover
  doc.setDrawColor(20, 83, 45); // #14532D
  doc.setLineWidth(0.45);
  doc.rect(13, 13, pageW - 26, pageH - 26);

  // Course & degree header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(154, 52, 18); // #9A3412 terracotta
  const courseHeader = `${settings.courseTitle.toUpperCase()}  ·  ${settings.degreeLabel.toUpperCase()}`;
  doc.text(courseHeader, pageW / 2, 27, { align: 'center', maxWidth: pageW - 40 });

  // Main yearbook title
  doc.setFont('times', 'bold');
  doc.setFontSize(32);
  doc.setTextColor(27, 30, 27); // #1B1E1B
  doc.text(settings.brandName, pageW / 2, 41, { align: 'center' });

  doc.setFont('times', 'italic');
  doc.setFontSize(15);
  doc.setTextColor(82, 88, 82); // #525852
  doc.text(`Álbum Oficial de Formatura · ${settings.classYear}`, pageW / 2, 50, {
    align: 'center',
  });

  // Short accent rule
  doc.setDrawColor(20, 83, 45);
  doc.setLineWidth(0.6);
  doc.line(pageW / 2 - 22, 56, pageW / 2 + 22, 56);

  // Cover featured image inside passe-partout frame
  const coverBoxX = 24;
  const coverBoxY = 65;
  const coverBoxW = pageW - 48; // 162mm
  const coverBoxH = 104;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(221, 214, 197);
  doc.setLineWidth(0.4);
  doc.rect(coverBoxX, coverBoxY, coverBoxW, coverBoxH, 'FD');

  if (coverImage) {
    const innerPad = 4;
    const availW = coverBoxW - innerPad * 2;
    const availH = coverBoxH - innerPad * 2;
    const scale = Math.min(availW / coverImage.width, availH / coverImage.height);
    const drawW = coverImage.width * scale;
    const drawH = coverImage.height * scale;
    const drawX = coverBoxX + (coverBoxW - drawW) / 2;
    const drawY = coverBoxY + (coverBoxH - drawH) / 2;

    doc.addImage(coverImage.dataUrl, 'JPEG', drawX, drawY, drawW, drawH, undefined, 'MEDIUM');
  } else {
    doc.setFont('times', 'italic');
    doc.setFontSize(12);
    doc.setTextColor(82, 88, 82);
    doc.text(coverPhoto.title, pageW / 2, coverBoxY + coverBoxH / 2, { align: 'center' });
  }

  doc.setFont('courier', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(82, 88, 82);
  doc.text(
    `${coverPhoto.title} · ${coverPhoto.location}`,
    pageW / 2,
    coverBoxY + coverBoxH + 6,
    { align: 'center', maxWidth: coverBoxW }
  );

  // Editorial manifesto
  doc.setFont('times', 'normal');
  doc.setFontSize(11.5);
  doc.setTextColor(45, 49, 45);
  const introLines = doc.splitTextToSize(settings.introText, pageW - 52);
  doc.text(introLines.slice(0, 6), pageW / 2, 187, {
    align: 'center',
    lineHeightFactor: 1.45,
  });

  // Curatorial chapter index box
  const indexY = 228;
  doc.setDrawColor(221, 214, 197);
  doc.setLineWidth(0.3);
  doc.line(24, indexY - 5, pageW - 24, indexY - 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(20, 83, 45);
  doc.text('SUMÁRIO DO ACERVO PUBLICADO', 24, indexY);

  let rowY = indexY + 7;
  for (const cat of CATEGORY_SEQUENCE) {
    const meta = CATEGORY_META[cat];
    const customGuide = settings.guides[cat];
    const count = orderedPhotos.filter((p) => p.category === cat).length;

    doc.setFont('times', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(27, 30, 27);
    doc.text(`${meta.romanIndex} — ${customGuide?.label || meta.label}`, 24, rowY);

    doc.setFont('courier', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(82, 88, 82);
    doc.text(`${String(count).padStart(2, '0')} registros`, pageW - 24, rowY, { align: 'right' });

    rowY += 7;
  }

  // Cover footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(82, 88, 82);
  doc.text(settings.institution, pageW / 2, pageH - 22, { align: 'center' });

  const exportDate = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.text(`Edição compilada em ${exportDate} · Página 01 de ${String(totalPages).padStart(2, '0')}`, pageW / 2, pageH - 16.5, {
    align: 'center',
  });

  // =========================================================
  // PAGES 2..N: PHOTOGRAPHY PLATES
  // =========================================================
  orderedPhotos.forEach((photo, idx) => {
    doc.addPage();
    drawPageBackdrop(doc, pageW, pageH);

    const meta = CATEGORY_META[photo.category];
    const customGuide = settings.guides[photo.category];
    const guideTitle = customGuide?.label || meta.label;
    const loaded = loadedImages[idx];
    const pageNum = idx + 2;

    // Running Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(82, 88, 82);
    doc.text(`${settings.brandName.toUpperCase()} · ${settings.courseTitle.toUpperCase()}`, 20, 20);

    doc.setTextColor(154, 52, 18);
    doc.text(`${meta.romanIndex.toUpperCase()} · ${guideTitle.toUpperCase()}`, pageW - 20, 20, {
      align: 'right',
    });

    doc.setDrawColor(221, 214, 197);
    doc.setLineWidth(0.3);
    doc.line(20, 23.5, pageW - 20, 23.5);

    // Passe-partout image container
    const frameX = 20;
    const frameY = 32;
    const frameW = pageW - 40; // 170mm
    const frameH = 128;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(221, 214, 197);
    doc.setLineWidth(0.4);
    doc.rect(frameX, frameY, frameW, frameH, 'FD');

    if (loaded) {
      const pad = 4;
      const availW = frameW - pad * 2;
      const availH = frameH - pad * 2;
      const scale = Math.min(availW / loaded.width, availH / loaded.height);
      const drawW = loaded.width * scale;
      const drawH = loaded.height * scale;
      const drawX = frameX + (frameW - drawW) / 2;
      const drawY = frameY + (frameH - drawH) / 2;

      doc.addImage(loaded.dataUrl, 'JPEG', drawX, drawY, drawW, drawH, undefined, 'MEDIUM');

      if (photo.photographer.trim()) {
        doc.setFont('courier', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(245, 245, 245);
        doc.text(`© ${photo.photographer.trim()}`, drawX + 3, drawY + drawH - 3);
      }
    } else {
      doc.setFillColor(239, 236, 226);
      doc.rect(frameX + 4, frameY + 4, frameW - 8, frameH - 8, 'F');
      doc.setFont('times', 'italic');
      doc.setFontSize(12);
      doc.setTextColor(82, 88, 82);
      doc.text('Imagem externa indisponível para incorporação direta no PDF.', pageW / 2, frameY + frameH / 2 - 3, {
        align: 'center',
      });
      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
      doc.text(photo.imageUrl.slice(0, 80), pageW / 2, frameY + frameH / 2 + 5, {
        align: 'center',
      });
    }

    // Editorial Ficha Catalográfica below image
    let cursorY = frameY + frameH + 14;

    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(154, 52, 18);
    doc.text(`${photo.yearLabel}  ·  ${photo.location}`, 20, cursorY, {
      maxWidth: frameW,
    });

    cursorY += 9;
    doc.setFont('times', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(27, 30, 27);
    const titleLines = doc.splitTextToSize(photo.title, frameW);
    doc.text(titleLines.slice(0, 3), 20, cursorY, { lineHeightFactor: 1.18 });
    cursorY += titleLines.slice(0, 3).length * 8.2 + 2;

    // Forest green short rule
    doc.setDrawColor(20, 83, 45);
    doc.setLineWidth(0.55);
    doc.line(20, cursorY, 44, cursorY);
    cursorY += 8;

    // Narrative caption (optional)
    if (photo.caption.trim()) {
      doc.setFont('times', 'normal');
      doc.setFontSize(11.5);
      doc.setTextColor(45, 49, 45);
      const maxCaptionLines = Math.max(3, Math.floor((pageH - 42 - cursorY) / 5.8));
      const captionLines = doc.splitTextToSize(photo.caption, frameW);
      doc.text(captionLines.slice(0, maxCaptionLines), 20, cursorY, {
        lineHeightFactor: 1.45,
      });
    }

    // Credit & technical metadata block above footer
    const metaBoxY = pageH - 34;
    doc.setDrawColor(221, 214, 197);
    doc.setLineWidth(0.3);
    doc.line(20, metaBoxY, pageW - 20, metaBoxY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(82, 88, 82);
    doc.text(`Guia: ${guideTitle}`, 20, metaBoxY + 6);
    if (photo.photographer.trim()) {
      doc.text(`Registro / Crédito: ${photo.photographer}`, pageW - 20, metaBoxY + 6, {
        align: 'right',
      });
    }

    // Running Footer
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(82, 88, 82);
    doc.text(`${settings.courseTitle} — ${settings.degreeLabel} · ${settings.classYear}`, 20, pageH - 16);
    doc.text(
      `Página ${String(pageNum).padStart(2, '0')} de ${String(totalPages).padStart(2, '0')}`,
      pageW - 20,
      pageH - 16,
      { align: 'right' }
    );
  });

  doc.save(buildSafeFilename(settings));
  return orderedPhotos.length;
}
