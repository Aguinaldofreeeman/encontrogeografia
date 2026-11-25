import { MessageSquare, Send } from 'lucide-react';
import React, { useState } from 'react';
import { VALIDATION_BOUNDS } from '../lib/validation';
import { submitComment } from '../services/blogService';
import { CommentItem, CommentRelation, CommentTargetType } from '../types';

interface CommentsSectionProps {
  comments: CommentItem[];
  photoId: string;
  targetType: CommentTargetType;
  photoTitle?: string;
  isSeedPreview?: boolean;
  formTitle?: string;
  formNotice?: string;
  onNotify?: (message: string) => void;
}

export function CommentsSection({
  comments,
  photoId,
  targetType,
  photoTitle,
  isSeedPreview = false,
  formTitle,
  formNotice,
  onNotify,
}: CommentsSectionProps) {
  const [authorName, setAuthorName] = useState('');
  const [authorRelation, setAuthorRelation] = useState<CommentRelation>('Colega de Turma');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const formatDate = (ms: number): string => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(ms));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const trimmedName = authorName.trim();
    const trimmedText = text.trim();

    if (trimmedName.length < VALIDATION_BOUNDS.comment.authorNameMin) {
      setFeedback({ type: 'error', message: 'Informe seu nome com pelo menos 2 caracteres.' });
      return;
    }
    if (trimmedText.length < VALIDATION_BOUNDS.comment.textMin) {
      setFeedback({ type: 'error', message: 'Escreva uma mensagem com pelo menos 4 caracteres.' });
      return;
    }

    setSubmitting(true);
    try {
      const effectiveTarget: CommentTargetType = isSeedPreview ? 'album' : targetType;
      const effectivePhotoId = isSeedPreview ? 'album' : photoId;
      const effectiveText =
        isSeedPreview && photoTitle
          ? `[Sobre ${photoTitle}] ${trimmedText}`.slice(0, VALIDATION_BOUNDS.comment.textMax)
          : trimmedText;

      await submitComment({
        photoId: effectivePhotoId,
        targetType: effectiveTarget,
        authorName: trimmedName,
        authorRelation,
        text: effectiveText,
      });

      setAuthorName('');
      setText('');
      const okMsg = 'Mensagem enviada para a fila de moderação do administrador.';
      setFeedback({ type: 'success', message: okMsg });
      onNotify?.(okMsg);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível enviar seu comentário.';
      setFeedback({ type: 'error', message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleSubmit}
        className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-6 space-y-4"
      >
        <div className="flex items-center justify-between gap-4 border-b border-[var(--border-soft)] pb-3">
          <h3 className="font-serif text-xl font-semibold text-[var(--text-primary)]">
            {targetType === 'photo'
              ? 'Comentar esta fotografia'
              : formTitle || 'Deixe uma mensagem no caderno da turma'}
          </h3>
          <span className="font-mono text-xs text-[var(--text-muted)] tabular-nums">
            Moderação ativa
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--text-muted)]">Seu nome</span>
            <input
              type="text"
              required
              maxLength={VALIDATION_BOUNDS.comment.authorNameMax}
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Ex.: Mariana Oliveira"
              className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--text-muted)]">Vínculo com a turma</span>
            <select
              value={authorRelation}
              onChange={(e) => setAuthorRelation(e.target.value as CommentRelation)}
              className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
            >
              {VALIDATION_BOUNDS.comment.relations.map((rel) => (
                <option key={rel} value={rel}>
                  {rel}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">Sua homenagem ou lembrança</span>
            <span className="font-mono text-[11px] text-[var(--text-subtle)] tabular-nums">
              {text.length}/{VALIDATION_BOUNDS.comment.textMax}
            </span>
          </div>
          <textarea
            rows={3}
            required
            maxLength={VALIDATION_BOUNDS.comment.textMax}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Compartilhe uma lembrança de campo, uma mensagem aos formandos ou um elogio ao registro..."
            className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-forest-ink)] resize-y"
          />
        </label>

        {feedback && (
          <p
            role="status"
            className={`text-xs px-3.5 py-2.5 border ${
              feedback.type === 'success'
                ? 'bg-[var(--feedback-success-bg)] border-[var(--feedback-success-border)] text-[var(--feedback-success-text)]'
                : 'bg-[var(--feedback-error-bg)] border-[var(--feedback-error-border)] text-[var(--feedback-error-text)]'
            }`}
          >
            {feedback.message}
          </p>
        )}

        <div className="flex items-center justify-between gap-4 pt-1">
          <p className="text-xs text-[var(--text-muted)]">
            {formNotice || 'Comentários ficam visíveis após aprovação editorial.'}
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--accent-forest)] text-[var(--accent-forest-contrast)] text-sm font-medium hover:bg-[var(--accent-forest-hover)] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Enviando...' : 'Publicar Recado'}
          </button>
        </div>
      </form>

      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-2.5">
          <h4 className="font-serif text-lg font-semibold text-[var(--text-primary)]">
            Registros Aprovados
          </h4>
          <span className="font-mono text-xs text-[var(--text-muted)] tabular-nums">
            {comments.length} {comments.length === 1 ? 'comentário' : 'comentários'}
          </span>
        </div>

        {comments.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-[var(--border-hairline)] bg-[var(--bg-surface-empty)] px-6">
            <MessageSquare className="w-5 h-5 text-[var(--text-subtle)] mx-auto mb-2" />
            <p className="text-sm text-[var(--text-muted)]">
              Ainda não há mensagens aprovadas neste espaço. Seja a primeira pessoa a deixar uma lembrança.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)] bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
            {comments.map((item) => (
              <article key={item.id} className="p-5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--text-primary)] text-sm">
                      {item.authorName}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{item.authorRelation}</span>
                  </div>
                  <time className="font-mono text-[11px] text-[var(--text-subtle)] tabular-nums">
                    {formatDate(item.createdAtMs)}
                  </time>
                </div>
                <p className="text-sm text-[var(--text-prose)] leading-relaxed whitespace-pre-line">
                  {item.text}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
