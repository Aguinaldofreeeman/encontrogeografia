import { ChevronLeft, ChevronRight, Compass, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CATEGORY_META } from '../data/seedData';
import { AlbumSettings, CommentItem, PhotoItem } from '../types';
import { CommentsSection } from './CommentsSection';
import { ShareBar } from './ShareBar';

interface PhotoLightboxProps {
  photo: PhotoItem | null;
  photosInScope: PhotoItem[];
  comments: CommentItem[];
  settings?: AlbumSettings;
  onClose: () => void;
  onSelectPhoto: (photo: PhotoItem) => void;
  onNotify?: (message: string) => void;
}

export function PhotoLightbox({
  photo,
  photosInScope,
  comments,
  settings,
  onClose,
  onSelectPhoto,
  onNotify,
}: PhotoLightboxProps) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [photo?.id]);

  useEffect(() => {
    if (!photo) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        const idx = photosInScope.findIndex((p) => p.id === photo.id);
        if (idx >= 0 && idx < photosInScope.length - 1) {
          onSelectPhoto(photosInScope[idx + 1]);
        }
      } else if (e.key === 'ArrowLeft') {
        const idx = photosInScope.findIndex((p) => p.id === photo.id);
        if (idx > 0) {
          onSelectPhoto(photosInScope[idx - 1]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photo, photosInScope, onClose, onSelectPhoto]);

  if (!photo) return null;

  const currentIndex = photosInScope.findIndex((p) => p.id === photo.id);
  const prevPhoto = currentIndex > 0 ? photosInScope[currentIndex - 1] : null;
  const nextPhoto =
    currentIndex >= 0 && currentIndex < photosInScope.length - 1
      ? photosInScope[currentIndex + 1]
      : null;

  const photoComments = comments.filter(
    (c) => c.targetType === 'photo' && c.photoId === photo.id
  );
  const baseCategoryInfo = CATEGORY_META[photo.category];
  const guideConfig = settings?.guides?.[photo.category] || baseCategoryInfo;
  const guideLabel = guideConfig.label;
  const guideRomanIndex = guideConfig.romanIndex || baseCategoryInfo.romanIndex;

  return (
    <div
      className="fixed inset-0 z-50 bg-[var(--bg-backdrop)] backdrop-blur-xs overflow-y-auto p-4 sm:p-6 lg:p-10"
      role="dialog"
      aria-modal="true"
      aria-label={photo.title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-w-6xl mx-auto bg-[var(--bg-canvas)] border border-[var(--border-hairline)] shadow-2xl overflow-hidden">
        {/* Top bar of lightbox */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 bg-[var(--bg-surface)] border-b border-[var(--border-hairline)]">
          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] min-w-0">
            <span className="font-mono uppercase tracking-widest text-[var(--accent-terracotta)] shrink-0">
              {guideRomanIndex}
            </span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{guideLabel}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={!prevPhoto}
              onClick={() => prevPhoto && onSelectPhoto(prevPhoto)}
              aria-label="Foto anterior"
              className="p-2 border border-[var(--border-hairline)] text-[var(--text-primary)] hover:border-[var(--accent-forest-ink)] disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={!nextPhoto}
              onClick={() => nextPhoto && onSelectPhoto(nextPhoto)}
              aria-label="Próxima foto"
              className="p-2 border border-[var(--border-hairline)] text-[var(--text-primary)] hover:border-[var(--accent-forest-ink)] disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar visualizador"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[var(--btn-active-bg)] text-[var(--btn-active-text)] text-xs font-medium hover:bg-[var(--accent-forest)] hover:text-[var(--accent-forest-contrast)] transition-colors cursor-pointer ml-2 whitespace-nowrap"
            >
              <X className="w-4 h-4" />
              Fechar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Image showcase */}
          <div className="lg:col-span-7 relative bg-[var(--bg-stage)] flex items-center justify-center min-h-[320px] lg:min-h-[540px] p-4 sm:p-6">
            {imageError ? (
              <div className="text-center text-[#DDD6C5] space-y-2 p-8">
                <Compass className="w-8 h-8 mx-auto opacity-70" />
                <p className="font-serif text-lg">{photo.title}</p>
                <p className="text-xs opacity-75">Imagem indisponível no endereço informado.</p>
              </div>
            ) : (
              <>
                <img
                  src={photo.imageUrl}
                  alt={photo.title}
                  referrerPolicy="no-referrer"
                  onError={() => setImageError(true)}
                  className="max-h-[72vh] w-auto object-contain mx-auto"
                />
                {photo.photographer.trim() && (
                  <span className="pointer-events-none select-none absolute bottom-3 left-4 font-mono text-[11px] tracking-wide text-[#F9F7F1]/60 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                    © {photo.photographer.trim()}
                  </span>
                )}
              </>
            )}
          </div>

          {/* Curatorial ficha & share */}
          <div className="lg:col-span-5 p-6 sm:p-8 bg-[var(--bg-canvas)] border-t lg:border-t-0 lg:border-l border-[var(--border-hairline)] flex flex-col justify-between gap-6">
            <div className="space-y-5">
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-[var(--accent-forest-ink)] mb-2">
                  {guideRomanIndex} · {photo.yearLabel}
                </p>
                <h2 className="font-serif text-3xl font-semibold text-[var(--text-primary)] leading-tight">
                  {photo.title}
                </h2>
              </div>

              {photo.caption.trim() && (
                <p className="text-sm sm:text-base text-[var(--text-prose)] leading-relaxed">
                  {photo.caption}
                </p>
              )}

              <dl className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)] text-xs">
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="font-mono uppercase tracking-wider text-[var(--text-muted)]">Território / Local</dt>
                  <dd className="text-right font-medium text-[var(--text-primary)]">{photo.location}</dd>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="font-mono uppercase tracking-wider text-[var(--text-muted)]">Período</dt>
                  <dd className="text-right font-mono text-[var(--text-primary)] tabular-nums">{photo.yearLabel}</dd>
                </div>
                {photo.photographer.trim() && (
                  <div className="py-2.5 flex items-center justify-between gap-4">
                    <dt className="font-mono uppercase tracking-wider text-[var(--text-muted)]">Registro / Crédito</dt>
                    <dd className="text-right font-medium text-[var(--text-primary)]">{photo.photographer}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="pt-2 border-t border-[var(--border-hairline)]">
              <ShareBar
                title={photo.title}
                description={`${photo.location} (${photo.yearLabel}) — Geografia Licenciatura Plena e Bacharelado`}
                photoId={photo.id}
                category={photo.category}
                onNotify={onNotify}
              />
            </div>
          </div>
        </div>

        {/* Comments for this photo */}
        <div className="p-6 sm:p-8 bg-[var(--bg-surface-alt)] border-t border-[var(--border-hairline)]">
          <div className="max-w-3xl mx-auto">
            <CommentsSection
              comments={photoComments}
              photoId={photo.id}
              targetType="photo"
              photoTitle={photo.title}
              isSeedPreview={Boolean(photo.isSeedPreview)}
              formNotice={settings?.commentFormNotice}
              onNotify={onNotify}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
