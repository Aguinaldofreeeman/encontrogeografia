import { Compass, Maximize2, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { PhotoItem } from '../types';

interface PhotoCardProps {
  photo: PhotoItem;
  commentCount: number;
  featuredLayout?: boolean;
  onOpen: (photo: PhotoItem) => void;
}

export function PhotoCard({
  photo,
  commentCount,
  featuredLayout = false,
  onOpen,
}: PhotoCardProps) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <article
      className={`group bg-[var(--bg-surface)] border border-[var(--border-hairline)] hover:border-[var(--accent-forest-ink)]/60 transition-colors flex flex-col ${
        featuredLayout ? 'lg:grid lg:grid-cols-12 lg:items-stretch' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(photo)}
        className={`relative overflow-hidden bg-[var(--bg-surface-muted)] text-left cursor-pointer block focus-visible:outline-2 focus-visible:outline-[var(--accent-forest-ink)] ${
          featuredLayout ? 'lg:col-span-7 min-h-[260px] lg:min-h-[380px]' : 'aspect-[4/3] w-full'
        }`}
      >
        {imgFailed ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-[var(--bg-fallback-from)] to-[var(--bg-fallback-to)] text-[var(--text-muted)]">
            <Compass className="w-7 h-7 mb-2 opacity-60" />
            <span className="font-serif text-base text-[var(--text-primary)]">{photo.title}</span>
          </div>
        ) : (
          <img
            src={photo.imageUrl}
            alt={photo.title}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
          />
        )}

        {photo.photographer.trim() && !imgFailed && (
          <span className="pointer-events-none select-none absolute bottom-2.5 left-3 font-mono text-[10px] sm:text-[11px] tracking-wide text-[#F9F7F1]/60 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">
            © {photo.photographer.trim()}
          </span>
        )}

        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#1B1E1B]/85 text-[#F9F7F1] text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Maximize2 className="w-3 h-3" />
          Ampliar
        </span>
      </button>

      <div
        className={`p-5 sm:p-6 flex flex-col justify-between gap-4 ${
          featuredLayout ? 'lg:col-span-5 lg:p-8' : 'flex-1'
        }`}
      >
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="font-mono tabular-nums">{photo.yearLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate max-w-[200px]">{photo.location}</span>
          </div>

          <h3
            className={`font-serif font-semibold text-[var(--text-primary)] leading-snug ${
              featuredLayout ? 'text-2xl sm:text-3xl' : 'text-xl'
            }`}
          >
            <button
              type="button"
              onClick={() => onOpen(photo)}
              className="text-left hover:text-[var(--accent-forest-ink)] transition-colors cursor-pointer"
            >
              {photo.title}
            </button>
          </h3>

          {photo.caption.trim() && (
            <p className="text-sm text-[var(--text-muted)] leading-relaxed line-clamp-3">
              {photo.caption}
            </p>
          )}
        </div>

        <div className="pt-3 border-t border-[var(--border-soft)] flex items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
          {photo.photographer.trim() ? (
            <span className="truncate">Por {photo.photographer}</span>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={() => onOpen(photo)}
            className="inline-flex items-center gap-1.5 font-medium text-[var(--accent-forest-ink)] hover:underline cursor-pointer whitespace-nowrap shrink-0"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="tabular-nums">
              {commentCount > 0 ? `${commentCount} recados` : 'Ver foto'}
            </span>
          </button>
        </div>
      </div>
    </article>
  );
}
