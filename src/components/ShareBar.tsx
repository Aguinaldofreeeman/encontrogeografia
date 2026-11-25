import { Check, Copy, Share2 } from 'lucide-react';
import { useState } from 'react';
import { PhotoCategory } from '../types';

interface ShareBarProps {
  title: string;
  description: string;
  photoId?: string;
  category?: PhotoCategory;
  compact?: boolean;
  onNotify?: (msg: string) => void;
}

export function ShareBar({
  title,
  description,
  photoId,
  category,
  compact = false,
  onNotify,
}: ShareBarProps) {
  const [copied, setCopied] = useState(false);

  const buildShareUrl = (): string => {
    const url = new URL(window.location.href);
    url.search = '';
    if (category) {
      url.searchParams.set('guia', category);
    }
    if (photoId) {
      url.searchParams.set('foto', photoId);
    }
    return url.toString();
  };

  const shareUrl = buildShareUrl();
  const shareMessage = `${title} — ${description}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      onNotify?.('Link copiado para a área de transferência.');
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      onNotify?.('Não foi possível copiar automaticamente. Copie o endereço da barra do navegador.');
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url: shareUrl,
        });
      } catch {
        // User cancelled share sheet
      }
    } else {
      await handleCopyLink();
    }
  };

  const links = [
    {
      name: 'WhatsApp',
      href: `https://wa.me/?text=${encodeURIComponent(`${shareMessage} ${shareUrl}`)}`,
    },
    {
      name: 'X',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!compact && (
        <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] mr-1">
          Compartilhar:
        </span>
      )}

      {links.map((item) => (
        <a
          key={item.name}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] bg-[var(--bg-surface-alt)] border border-[var(--border-hairline)] hover:border-[var(--accent-forest-ink)] hover:text-[var(--accent-forest-ink)] transition-colors whitespace-nowrap shrink-0"
        >
          {item.name}
        </a>
      ))}

      <button
        type="button"
        onClick={handleCopyLink}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] bg-[var(--bg-surface)] border border-[var(--border-hairline)] hover:border-[var(--accent-forest-ink)] hover:text-[var(--accent-forest-ink)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-[var(--accent-forest-ink)]" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
        {copied ? 'Copiado' : 'Copiar link'}
      </button>

      {typeof navigator !== 'undefined' && 'share' in navigator && (
        <button
          type="button"
          onClick={handleNativeShare}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--accent-forest-contrast)] bg-[var(--accent-ocean)] hover:bg-[var(--accent-ocean-hover)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Share2 className="w-3.5 h-3.5" />
          Enviar
        </button>
      )}
    </div>
  );
}
