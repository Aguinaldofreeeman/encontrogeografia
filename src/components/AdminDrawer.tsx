import type { User } from '@supabase/supabase-js';
import {
  CheckCircle2,
  ChevronRight,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  ImagePlus,
  LogIn,
  LogOut,
  MessageSquare,
  Plus,
  RotateCcw,
  Settings,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { CATEGORY_META, DEFAULT_SEED_PHOTOS, DEFAULT_SETTINGS } from '../data/seedData';
import { uploadPhotoToStorage } from '../lib/storage';
import { isBootstrappedAdminEmail, supabase } from '../lib/supabase';
import { compressImageFile, isAllowedImageUrl, VALIDATION_BOUNDS } from '../lib/validation';
import {
  addAdminInvite,
  createPhoto,
  deleteComment,
  deletePhoto,
  moderateComment,
  removeAdminInvite,
  removeAdminUser,
  saveAlbumSettings,
  saveSeedPhoto,
  subscribeAdminInvites,
  subscribeAdmins,
  updateCommentContent,
  updatePhoto,
} from '../services/blogService';
import {
  AdminInviteItem,
  AdminUserItem,
  AlbumSettings,
  CommentItem,
  CommentRelation,
  GuideTextConfig,
  PhotoCategory,
  PhotoItem,
  PhotoVisibility,
} from '../types';

interface AdminDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  isAdmin: boolean;
  isBootstrappedAdmin: boolean;
  photos: PhotoItem[];
  hasRemotePhotos: boolean;
  comments: CommentItem[];
  settings: AlbumSettings;
  onNotify: (msg: string) => void;
}

type AdminTab = 'publish' | 'manage' | 'comments' | 'settings';

export function AdminDrawer({
  isOpen,
  onClose,
  user,
  isAdmin,
  isBootstrappedAdmin,
  photos,
  hasRemotePhotos,
  comments,
  settings,
  onNotify,
}: AdminDrawerProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('publish');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  const [authMode, setAuthMode] = useState<'magic' | 'password'>('password');
  const [authPassword, setAuthPassword] = useState('');

  // Photo form state
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [editingIsSeed, setEditingIsSeed] = useState(false);
  const [category, setCategory] = useState<PhotoCategory>('historico');
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [imageMode, setImageMode] = useState<'upload' | 'url'>('upload');
  const [imageUrl, setImageUrl] = useState('');
  const [yearLabel, setYearLabel] = useState('2024');
  const [location, setLocation] = useState('');
  const [photographer, setPhotographer] = useState('');
  const [featured, setFeatured] = useState(false);
  const [visibility, setVisibility] = useState<PhotoVisibility>('public');
  const [compressing, setCompressing] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Comment edit state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentAuthor, setEditCommentAuthor] = useState('');
  const [editCommentRelation, setEditCommentRelation] = useState<CommentRelation>('Colega de Turma');
  const [editCommentText, setEditCommentText] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const [commentEditError, setCommentEditError] = useState<string | null>(null);

  // Settings form state
  const [settingsForm, setSettingsForm] = useState<AlbumSettings>(settings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Admin management state
  const [adminsList, setAdminsList] = useState<AdminUserItem[]>([]);
  const [adminInvitesList, setAdminInvitesList] = useState<AdminInviteItem[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);

  // Seed action state
  const [seeding, setSeeding] = useState(false);
  const [seedProgress, setSeedProgress] = useState<string | null>(null);

  useEffect(() => {
    setSettingsForm(settings);
  }, [settings]);

  useEffect(() => {
    if (!isOpen || !isBootstrappedAdmin) return;
    const unsubAdmins = subscribeAdmins(
      true,
      (list) => setAdminsList(list),
      () => {}
    );
    const unsubInvites = subscribeAdminInvites(
      true,
      (list) => setAdminInvitesList(list),
      () => {}
    );
    return () => {
      unsubAdmins();
      unsubInvites();
    };
  }, [isOpen, isBootstrappedAdmin]);

  if (!isOpen) return null;

  const pendingComments = comments.filter((c) => c.status === 'pending');
  const approvedComments = comments.filter((c) => c.status === 'approved');
  const remotePhotos = photos.filter((p) => !p.isSeedPreview);

  const resetPhotoForm = () => {
    setEditingPhotoId(null);
    setEditingIsSeed(false);
    setCategory('historico');
    setTitle('');
    setCaption('');
    setImageUrl('');
    setYearLabel('2024');
    setLocation('');
    setPhotographer('');
    setFeatured(false);
    setVisibility('public');
    setPhotoError(null);
  };

  const startEditPhoto = (photo: PhotoItem) => {
    setEditingPhotoId(photo.id);
    setEditingIsSeed(Boolean(photo.isSeedPreview));
    setCategory(photo.category);
    setTitle(photo.title);
    setCaption(photo.caption);
    setImageUrl(photo.imageUrl);
    setImageMode(photo.imageUrl.startsWith('data:image/') ? 'upload' : 'url');
    setYearLabel(photo.yearLabel);
    setLocation(photo.location);
    setPhotographer(photo.photographer);
    setFeatured(photo.featured);
    setVisibility(photo.visibility);
    setPhotoError(null);
    setActiveTab('publish');
  };

  const handlePasswordSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    const email = magicLinkEmail.trim().toLowerCase();
    const password = authPassword;
    if (!email) { setAuthError('Informe seu e-mail.'); setAuthLoading(false); return; }
    if (password.length < 6) { setAuthError('A senha deve ter ao menos 6 caracteres.'); setAuthLoading(false); return; }
    try {
      // Try sign in first
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (!signInError) {
        onNotify('Login realizado com sucesso.');
        setAuthPassword('');
        setAuthLoading(false);
        return;
      }
      // If invalid credentials, try sign up (autoconfirm is enabled)
      if (/invalid|credentials|not found/i.test(signInError.message)) {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) {
          // If user already exists, it's wrong password
          if (/already|registered|exists/i.test(signUpError.message)) throw new Error('Senha incorreta. Use "Esqueci a senha" ou tente novamente.');
          throw signUpError;
        }
        const { error: retryError } = await supabase.auth.signInWithPassword({ email, password });
        if (retryError) throw retryError;
        onNotify('Conta criada e login realizado.');
        setAuthPassword('');
        setAuthLoading(false);
        return;
      }
      throw signInError;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao autenticar.';
      setAuthError(msg);
    }
    setAuthLoading(false);
  };

  const handlePasswordReset = async () => {
    setAuthLoading(true);
    setAuthError(null);
    const email = magicLinkEmail.trim().toLowerCase();
    if (!email) { setAuthError('Informe seu e-mail para redefinir a senha.'); setAuthLoading(false); return; }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/` });
      if (error) throw error;
      onNotify('Se o e-mail existir, você receberá um link para redefinir a senha.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao solicitar redefinição de senha.';
      setAuthError(msg);
    }
    setAuthLoading(false);
  };

  const handleMagicLinkSend = async () => {
    setAuthLoading(true);
    setAuthError(null);
    if (!magicLinkEmail.trim()) {
      setAuthError('Informe seu e-mail.');
      setAuthLoading(false);
      return;
    }
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: magicLinkEmail.trim(),
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
      onNotify('Link mágico enviado para o e-mail. Verifique a caixa de entrada.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao enviar link mágico.';
      setAuthError(msg);
    }
    setAuthLoading(false);
  };

  const handleMagicLinkCancel = () => {
    setMagicLinkEmail('');
    setAuthPassword('');
    setAuthError(null);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    onNotify('Sessão administrativa encerrada.');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    setCompressing(true);
    try {
      const compressed = await compressImageFile(file);
      setImageUrl(compressed);
      onNotify('Imagem otimizada e pronta para publicação.');
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Erro ao processar arquivo.');
    } finally {
      setCompressing(false);
    }
  };

  const handleSavePhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin) return;
    setPhotoError(null);

    const isPendingUpload = imageUrl.trim().startsWith('data:image/');
    if (!isPendingUpload && !isAllowedImageUrl(imageUrl)) {
      setPhotoError('Adicione uma imagem por upload ou informe uma URL válida (https://).');
      return;
    }

    setSavingPhoto(true);
    try {
      let finalImageUrl = imageUrl.trim();

      if (isPendingUpload) {
        setUploading(true);
        const uploaded = await uploadPhotoToStorage(finalImageUrl, {
          category,
          title: title || 'fotografia',
        });
        finalImageUrl = uploaded.url;
        setImageUrl(uploaded.url);
      }

      if (!isAllowedImageUrl(finalImageUrl)) {
        throw new Error('A URL retornada pelo armazenamento não é válida.');
      }

      const payload = {
        category,
        title,
        caption,
        imageUrl: finalImageUrl,
        yearLabel,
        location,
        photographer,
        featured,
        visibility,
      };
      if (editingPhotoId && editingIsSeed) {
        await saveSeedPhoto(user.id, editingPhotoId, payload);
        onNotify('Prancha inicial atualizada e gravada no banco.');
      } else if (editingPhotoId) {
        await updatePhoto(editingPhotoId, payload);
        onNotify('Fotografia atualizada no acervo.');
      } else {
        await createPhoto(user.id, payload);
        onNotify('Nova fotografia publicada no álbum.');
      }
      resetPhotoForm();
      setActiveTab('manage');
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Erro ao salvar fotografia.');
    } finally {
      setUploading(false);
      setSavingPhoto(false);
    }
  };

  const handleSeedAlbum = async () => {
    if (!user || !isAdmin) return;
    setSeeding(true);
    setPhotoError(null);
    setSeedProgress(null);
    try {
      const prepared: { seed: (typeof DEFAULT_SEED_PHOTOS)[number]; imageUrl: string }[] = [];

      for (let index = 0; index < DEFAULT_SEED_PHOTOS.length; index += 1) {
        const seed = DEFAULT_SEED_PHOTOS[index];
        setSeedProgress(`Enviando ${index + 1} de ${DEFAULT_SEED_PHOTOS.length} ao armazenamento...`);

        const response = await fetch(seed.imageUrl);
        if (!response.ok) {
          throw new Error(`Não foi possível ler a imagem inicial "${seed.title}".`);
        }
        const blob = await response.blob();
        const file = new File([blob], `${seed.id}.jpg`, {
          type: blob.type || 'image/jpeg',
        });
        const dataUrl = await compressImageFile(file);
        const uploaded = await uploadPhotoToStorage(dataUrl, {
          category: seed.category,
          title: seed.title,
        });

        prepared.push({ seed, imageUrl: uploaded.url });
      }

      setSeedProgress('Gravando as fichas no banco...');
      for (const { seed, imageUrl } of prepared) {
        await saveSeedPhoto(user.id, seed.id, {
          category: seed.category,
          title: seed.title,
          caption: seed.caption,
          imageUrl,
          yearLabel: seed.yearLabel,
          location: seed.location,
          photographer: seed.photographer,
          featured: seed.featured,
          visibility: seed.visibility,
        });
      }

      onNotify('As pranchas iniciais foram migradas para o Supabase.');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Falha ao migrar as pranchas iniciais.';
      setPhotoError(message);
      onNotify(message);
    } finally {
      setSeedProgress(null);
      setSeeding(false);
    }
  };

  const handleModerate = async (commentId: string, status: 'approved' | 'pending') => {
    try {
      await moderateComment(commentId, status);
      onNotify(
        status === 'approved'
          ? 'Comentário aprovado e visível no álbum.'
          : 'Comentário movido de volta para revisão.'
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao atualizar comentário.');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteComment(commentId);
      onNotify('Comentário removido.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao excluir comentário.');
    }
  };

  const startEditComment = (comment: CommentItem) => {
    setEditingCommentId(comment.id);
    setEditCommentAuthor(comment.authorName);
    setEditCommentRelation(comment.authorRelation);
    setEditCommentText(comment.text);
    setCommentEditError(null);
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setCommentEditError(null);
  };

  const handleSaveCommentEdit = async (comment: CommentItem) => {
    setCommentEditError(null);
    setSavingComment(true);
    try {
      await updateCommentContent(comment.id, {
        authorName: editCommentAuthor,
        authorRelation: editCommentRelation,
        text: editCommentText,
        status: comment.status,
      });
      setEditingCommentId(null);
      onNotify('Comentário atualizado.');
    } catch (err) {
      setCommentEditError(err instanceof Error ? err.message : 'Erro ao editar comentário.');
    } finally {
      setSavingComment(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    try {
      await deletePhoto(photoId);
      onNotify('Fotografia excluída do banco.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao excluir fotografia.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin) return;
    setSettingsError(null);
    setSavingSettings(true);
    try {
      await saveAlbumSettings(user.id, settingsForm);
      onNotify('Todos os trechos do blog foram atualizados.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar configurações.';
      setSettingsError(msg);
      onNotify(msg);
    } finally {
      setSavingSettings(false);
    }
  };

  const updateGuideField = (
    cat: PhotoCategory,
    field: keyof GuideTextConfig,
    value: string
  ) => {
    setSettingsForm((prev) => ({
      ...prev,
      guides: {
        ...prev.guides,
        [cat]: {
          ...prev.guides[cat],
          [field]: value,
        },
      },
    }));
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBootstrappedAdmin || !user) return;
    setAddingAdmin(true);
    try {
      await addAdminInvite({
        email: newAdminEmail,
        displayName: newAdminName,
        createdByUid: user.id,
      });
      setNewAdminEmail('');
      setNewAdminName('');
      onNotify('E-mail autorizado como administrador. O UID será vinculado automaticamente no primeiro login.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao autorizar administrador.');
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleRemoveAdmin = async (uid: string, email: string) => {
    if (!isBootstrappedAdmin) return;
    try {
      await removeAdminUser(uid, email);
      onNotify('Permissão administrativa removida.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao remover administrador.');
    }
  };

  const handleRemoveInvite = async (inviteId: string) => {
    if (!isBootstrappedAdmin) return;
    try {
      await removeAdminInvite(inviteId);
      onNotify('Autorização por e-mail removida.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao remover autorização.');
    }
  };

  const handleCopyUid = async () => {
    if (!user) return;
    try {
      await navigator.clipboard.writeText(user.id);
      onNotify('Seu UID foi copiado.');
    } catch {
      onNotify('Não foi possível copiar o UID.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[var(--bg-backdrop-drawer)] backdrop-blur-xs flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Espaço Administrativo"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl bg-[var(--bg-canvas)] border-l border-[var(--border-hairline)] h-full overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[var(--bg-surface)] border-b border-[var(--border-hairline)] px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--accent-terracotta)]">
              Curadoria &amp; Publicação
            </p>
            <h2 className="font-serif text-2xl font-semibold text-[var(--text-primary)]">
              Espaço do Administrador
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[var(--text-muted)] border border-[var(--border-hairline)] hover:border-[var(--accent-terracotta)] hover:text-[var(--accent-terracotta)] transition-colors cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sair
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar painel administrativo"
              className="p-2 bg-[var(--btn-active-bg)] text-[var(--btn-active-text)] hover:bg-[var(--accent-forest)] hover:text-[var(--accent-forest-contrast)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-8 flex-1 space-y-6">
          {!user ? (
            <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-8 max-w-lg mx-auto my-8 space-y-5">
              <div className="space-y-2">
                <p className="font-mono text-xs uppercase tracking-widest text-[var(--accent-forest-ink)]">
                  Autenticação Necessária
                </p>
                <h3 className="font-serif text-2xl font-semibold text-[var(--text-primary)]">
                  Acesse com seu e-mail
                </h3>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                  Entre com e-mail e senha. Na primeira vez, a conta será criada automaticamente com a senha informada.
                </p>
              </div>

              <div className="flex gap-2 text-xs">
                <button type="button" onClick={() => { setAuthMode('password'); setAuthError(null); }}
                  className={`px-3 py-1.5 border transition-colors cursor-pointer ${authMode === 'password' ? 'bg-[var(--btn-active-bg)] text-[var(--btn-active-text)] border-[var(--btn-active-bg)]' : 'border-[var(--border-hairline)] text-[var(--text-muted)]'}`}>
                  E-mail e senha
                </button>
                <button type="button" onClick={() => { setAuthMode('magic'); setAuthError(null); }}
                  className={`px-3 py-1.5 border transition-colors cursor-pointer ${authMode === 'magic' ? 'bg-[var(--btn-active-bg)] text-[var(--btn-active-text)] border-[var(--btn-active-bg)]' : 'border-[var(--border-hairline)] text-[var(--text-muted)]'}`}>
                  Link mágico
                </button>
              </div>

              {authError && (
                <p className="text-xs bg-[var(--feedback-error-bg)] border border-[var(--feedback-error-border)] text-[var(--feedback-error-text)] p-3">
                  {authError}
                </p>
              )}

              {authLoading ? (
                <div className="flex items-center justify-center gap-2 py-4">
                  <svg className="animate-spin w-4 h-4 text-[var(--accent-forest)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  <span className="text-sm text-[var(--text-muted)]">Aguarde...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="email"
                    value={magicLinkEmail}
                    onChange={(e) => setMagicLinkEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                  />
                  {authMode === 'password' && (
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="Senha (mín. 6 caracteres)"
                      className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                    />
                  )}
                  <button
                    type="button"
                    onClick={authMode === 'password' ? handlePasswordSignIn : handleMagicLinkSend}
                    disabled={authLoading}
                    className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 bg-[var(--accent-forest)] text-[var(--accent-forest-contrast)] text-sm font-medium hover:bg-[var(--accent-forest-hover)] disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    <LogIn className="w-4 h-4 shrink-0" />
                    {authMode === 'password' ? 'Entrar / Criar conta' : 'Enviar link mágico'}
                  </button>
                  {authMode === 'password' && (
                    <button type="button" onClick={handlePasswordReset} disabled={authLoading}
                      className="w-full text-xs text-[var(--text-muted)] hover:text-[var(--accent-forest-ink)] transition-colors cursor-pointer">
                      Esqueci a senha / redefinir por e-mail
                    </button>
                  )}
                  <button type="button" onClick={handleMagicLinkCancel}
                    className="w-full text-xs text-[var(--text-muted)] border border-[var(--border-hairline)] py-1.5 rounded text-center hover:border-[var(--accent-forest-ink)] transition-colors cursor-pointer whitespace-nowrap">
                    Limpar
                  </button>
                  {authMode === 'magic' && (
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Se aparecer “email rate limit exceeded”, aguarde 1 minuto ou use “E-mail e senha”.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : !isAdmin ? (
            <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-8 max-w-lg mx-auto my-8 space-y-4">
              <div className="flex items-center gap-2 text-[var(--accent-terracotta)]">
                <ShieldAlert className="w-5 h-5" />
                <span className="font-mono text-xs uppercase tracking-widest">Acesso Restrito</span>
              </div>
              <h3 className="font-serif text-2xl font-semibold text-[var(--text-primary)]">
                Conta sem permissão administrativa
              </h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                Você está conectado como <strong>{user.email}</strong>. Apenas contas autorizadas (administradores principais ou e-mails liberados na administração) podem publicar fotografias e editar o álbum. Peça ao administrador principal para liberar o seu e-mail no Painel Admin.
              </p>
              <div className="bg-[var(--bg-canvas)] border border-[var(--border-hairline)] p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                    Seu UID (para solicitar liberação)
                  </p>
                  <p className="font-mono text-xs text-[var(--text-primary)] truncate">{user.id}</p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyUid}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-forest-ink)] cursor-pointer shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copiar
                </button>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="px-4 py-2.5 bg-[var(--btn-active-bg)] text-[var(--btn-active-text)] text-sm font-medium hover:bg-[var(--accent-forest)] hover:text-[var(--accent-forest-contrast)] transition-colors cursor-pointer"
              >
                Trocar de conta
              </button>
            </div>
          ) : (
            <>
              {/* Seed banner when the database has no photos yet */}
              {!hasRemotePhotos && (
                <div className="bg-[var(--bg-surface-muted)] border border-[var(--border-hairline)] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      O banco de dados ainda está vazio
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Deseja gravar as 6 pranchas iniciais de Geografia no Supabase para poder editá-las ou receber comentários individuais?
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={seeding}
                    onClick={handleSeedAlbum}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--accent-forest)] text-[var(--accent-forest-contrast)] text-xs font-medium hover:bg-[var(--accent-forest-hover)] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {seeding ? 'Salvando...' : 'Inicializar Acervo'}
                  </button>
                </div>
              )}

              {/* Sub-navigation */}
              <div className="flex flex-wrap items-center gap-1 p-1 bg-[var(--bg-surface-muted)] border border-[var(--border-hairline)]">
                <button
                  type="button"
                  onClick={() => setActiveTab('publish')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'publish'
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {editingPhotoId ? 'Editar Foto' : 'Publicar Foto'}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('manage')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'manage'
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  Acervo ({photos.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('comments')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'comments'
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Moderação ({pendingComments.length} pendentes)
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'settings'
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  Identidade
                </button>
              </div>

              {/* Tab 1: Publish / Edit Photo */}
              {activeTab === 'publish' && (
                <form
                  onSubmit={handleSavePhoto}
                  className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-6 space-y-5"
                >
                  <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-3">
                    <h3 className="font-serif text-xl font-semibold text-[var(--text-primary)]">
                      {editingPhotoId ? 'Editar registro fotográfico' : 'Nova publicação fotográfica'}
                    </h3>
                    {editingPhotoId && (
                      <button
                        type="button"
                        onClick={resetPhotoForm}
                        className="text-xs text-[var(--accent-terracotta)] hover:underline cursor-pointer"
                      >
                        Cancelar edição
                      </button>
                    )}
                  </div>

                  {editingPhotoId && editingIsSeed && (
                    <p className="text-xs bg-[var(--bg-surface-muted)] border border-[var(--border-hairline)] text-[var(--text-muted)] p-3">
                      Esta fotografia faz parte da prévia inicial do álbum. Ao salvar, ela será gravada no banco para edição permanente.
                    </p>
                  )}

                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-[var(--text-muted)]">Guia do blog</span>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as PhotoCategory)}
                      className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                    >
                      <option value="historico">
                        {settings.guides?.historico?.label || CATEGORY_META.historico.label}
                      </option>
                      <option value="formatura">
                        {settings.guides?.formatura?.label || CATEGORY_META.formatura.label}
                      </option>
                      <option value="turma">
                        {settings.guides?.turma?.label || CATEGORY_META.turma.label}
                      </option>
                    </select>
                  </label>

                  {/* Image source switcher */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[var(--text-muted)]">Origem da fotografia</span>
                      <div className="flex items-center gap-1 p-0.5 bg-[var(--bg-surface-muted)] border border-[var(--border-hairline)]">
                        <button
                          type="button"
                          onClick={() => setImageMode('upload')}
                          className={`px-3 py-1 text-xs font-medium cursor-pointer ${
                            imageMode === 'upload'
                              ? 'bg-[var(--bg-surface)] text-[var(--text-primary)]'
                              : 'text-[var(--text-muted)]'
                          }`}
                        >
                          Upload de arquivo
                        </button>
                        <button
                          type="button"
                          onClick={() => setImageMode('url')}
                          className={`px-3 py-1 text-xs font-medium cursor-pointer ${
                            imageMode === 'url'
                              ? 'bg-[var(--bg-surface)] text-[var(--text-primary)]'
                              : 'text-[var(--text-muted)]'
                          }`}
                        >
                          Link / URL
                        </button>
                      </div>
                    </div>

                    {imageMode === 'upload' ? (
                      <label className="flex flex-col items-center justify-center gap-2 border border-dashed border-[var(--border-dashed)] bg-[var(--bg-canvas)] p-6 text-center cursor-pointer hover:border-[var(--accent-forest-ink)] transition-colors">
                        <Upload className="w-5 h-5 text-[var(--accent-forest-ink)]" />
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          {compressing
                            ? 'Otimizando imagem para publicação...'
                            : 'Clique para selecionar uma foto do computador ou celular'}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">
                          Redimensionamento automático até 2000px (JPG, PNG ou WebP)
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="sr-only"
                        />
                      </label>
                    ) : (
                      <input
                        type="url"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="https://exemplo.com/foto-formatura.jpg"
                        className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                      />
                    )}

                    {imageUrl && (
                      <div className="border border-[var(--border-hairline)] bg-[var(--bg-surface-alt)] p-3 flex items-center gap-4">
                        <img
                          src={imageUrl}
                          alt="Pré-visualização"
                          referrerPolicy="no-referrer"
                          className="w-24 h-18 object-cover border border-[var(--border-hairline)]"
                        />
                        <div className="min-w-0 flex-1 text-xs text-[var(--text-muted)]">
                          <p className="font-medium text-[var(--text-primary)]">Pré-visualização carregada</p>
                          <p className="truncate font-mono text-[11px]">
                            {imageUrl.startsWith('data:image/')
                              ? `Arquivo comprimido (${Math.round(imageUrl.length / 1024)} KB)`
                              : imageUrl}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-[var(--text-muted)]">Título da fotografia</span>
                    <input
                      type="text"
                      required
                      maxLength={VALIDATION_BOUNDS.photo.titleMax}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex.: Trabalho de campo na Serra da Canastra"
                      className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-[var(--text-muted)]">
                      Legenda narrativa <span className="text-[var(--text-subtle)] font-normal">(opcional)</span>
                    </span>
                    <textarea
                      rows={3}
                      maxLength={VALIDATION_BOUNDS.photo.captionMax}
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Se desejar, descreva o contexto geográfico, a disciplina, o momento da formatura ou quem aparece no registro..."
                      className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                    />
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-[var(--text-muted)]">Ano / Período</span>
                      <input
                        type="text"
                        required
                        maxLength={VALIDATION_BOUNDS.photo.yearMax}
                        value={yearLabel}
                        onChange={(e) => setYearLabel(e.target.value)}
                        placeholder="Ex.: 2024 · 8º Semestre"
                        className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                      />
                    </label>

                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-[var(--text-muted)]">Local / Território</span>
                      <input
                        type="text"
                        required
                        maxLength={VALIDATION_BOUNDS.photo.locationMax}
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Ex.: Auditório Central"
                        className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                      />
                    </label>

                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-[var(--text-muted)]">
                        Crédito / Fotógrafo <span className="text-[var(--text-subtle)] font-normal">(opcional · marca d&apos;água na foto)</span>
                      </span>
                      <input
                        type="text"
                        maxLength={VALIDATION_BOUNDS.photo.photographerMax}
                        value={photographer}
                        onChange={(e) => setPhotographer(e.target.value)}
                        placeholder="Opcional (ex.: Comissão de Formatura)"
                        className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[var(--border-soft)]">
                    <div className="flex flex-wrap items-center gap-5 text-xs text-[var(--text-primary)]">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={featured}
                          onChange={(e) => setFeatured(e.target.checked)}
                          className="accent-[var(--accent-forest)]"
                        />
                        Destacar na capa do álbum
                      </label>

                      <label className="inline-flex items-center gap-2">
                        <span className="text-[var(--text-muted)]">Visibilidade:</span>
                        <select
                          value={visibility}
                          onChange={(e) => setVisibility(e.target.value as PhotoVisibility)}
                          className="px-2.5 py-1 bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] text-xs"
                        >
                          <option value="public">Publicada</option>
                          <option value="draft">Rascunho (oculta)</option>
                        </select>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={savingPhoto || compressing || uploading}
                      className="px-5 py-2.5 bg-[var(--accent-forest)] text-[var(--accent-forest-contrast)] text-sm font-medium hover:bg-[var(--accent-forest-hover)] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {uploading
                        ? 'Enviando ao armazenamento...'
                        : savingPhoto
                          ? 'Salvando...'
                          : editingPhotoId
                            ? 'Salvar Alterações'
                            : 'Publicar Fotografia'}
                    </button>
                  </div>

                  {photoError && (
                    <p className="text-xs bg-[var(--feedback-error-bg)] border border-[var(--feedback-error-border)] text-[var(--feedback-error-text)] p-3">
                      {photoError}
                    </p>
                  )}
                </form>
              )}

              {/* Tab 2: Manage Photos */}
              {activeTab === 'manage' && (
                <div className="space-y-3">
                  {!hasRemotePhotos && photos.length > 0 && (
                    <div className="bg-[var(--bg-surface-muted)] border border-[var(--border-hairline)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        As pranchas iniciais ainda usam as imagens do próprio site. Envie as 6
                        para o Supabase Storage e grave as fichas no banco de uma só vez.
                      </p>
                      <button
                        type="button"
                        disabled={seeding}
                        onClick={handleSeedAlbum}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[var(--accent-forest)] text-[var(--accent-forest-contrast)] text-xs font-medium hover:bg-[var(--accent-forest-hover)] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {seeding ? seedProgress || 'Enviando...' : 'Migrar 6 Pranchas para o Supabase'}
                      </button>
                    </div>
                  )}

                  {photos.length === 0 ? (
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-8 text-center text-sm text-[var(--text-muted)]">
                      Nenhuma fotografia no acervo ainda. Use a aba &ldquo;Publicar Foto&rdquo; para enviar o primeiro registro.
                    </div>
                  ) : (
                    photos.map((item) => {
                      const guideShort =
                        settings.guides?.[item.category]?.shortLabel ||
                        CATEGORY_META[item.category].shortLabel;
                      return (
                        <div
                          key={item.id}
                          className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              referrerPolicy="no-referrer"
                              className="w-20 h-16 object-cover border border-[var(--border-hairline)] shrink-0"
                            />
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                                <span className="font-mono text-[var(--accent-terracotta)]">{guideShort}</span>
                                <span>·</span>
                                <span>
                                  {item.isSeedPreview
                                    ? 'Prévia inicial'
                                    : item.visibility === 'public'
                                      ? 'Publicada'
                                      : 'Rascunho'}
                                </span>
                              </div>
                              <h4 className="font-serif text-lg font-semibold text-[var(--text-primary)] truncate">
                                {item.title}
                              </h4>
                              <p className="text-xs text-[var(--text-muted)] truncate">
                                {item.yearLabel} · {item.location}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => startEditPhoto(item)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--border-hairline)] text-[var(--text-primary)] hover:border-[var(--accent-forest-ink)] cursor-pointer whitespace-nowrap"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Editar
                            </button>
                            {!item.isSeedPreview && (
                              <button
                                type="button"
                                onClick={() => handleDeletePhoto(item.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--border-hairline)] text-[var(--accent-terracotta)] hover:bg-[var(--feedback-error-bg)] cursor-pointer whitespace-nowrap"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Excluir
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Tab 3: Moderate Comments */}
              {activeTab === 'comments' && (
                <div className="space-y-6">
                  {commentEditError && (
                    <p className="text-xs bg-[var(--feedback-error-bg)] border border-[var(--feedback-error-border)] text-[var(--feedback-error-text)] p-3">
                      {commentEditError}
                    </p>
                  )}

                  <div className="space-y-3">
                    <h3 className="font-serif text-lg font-semibold text-[var(--text-primary)]">
                      Aguardando Aprovação ({pendingComments.length})
                    </h3>
                    {pendingComments.length === 0 ? (
                      <p className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-5 text-sm text-[var(--text-muted)]">
                        Nenhum comentário pendente na fila.
                      </p>
                    ) : (
                      pendingComments.map((c) => {
                        const isEditingThis = editingCommentId === c.id;
                        return (
                          <div key={c.id} className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-5 space-y-3">
                            {isEditingThis ? (
                              <div className="space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <label className="block space-y-1">
                                    <span className="text-xs font-medium text-[var(--text-muted)]">Autor</span>
                                    <input
                                      type="text"
                                      maxLength={VALIDATION_BOUNDS.comment.authorNameMax}
                                      value={editCommentAuthor}
                                      onChange={(e) => setEditCommentAuthor(e.target.value)}
                                      className="w-full px-3 py-2 text-xs bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                                    />
                                  </label>
                                  <label className="block space-y-1">
                                    <span className="text-xs font-medium text-[var(--text-muted)]">Vínculo</span>
                                    <select
                                      value={editCommentRelation}
                                      onChange={(e) => setEditCommentRelation(e.target.value as CommentRelation)}
                                      className="w-full px-3 py-2 text-xs bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                                    >
                                      {VALIDATION_BOUNDS.comment.relations.map((rel) => (
                                        <option key={rel} value={rel}>
                                          {rel}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                                <label className="block space-y-1">
                                  <span className="text-xs font-medium text-[var(--text-muted)]">Mensagem</span>
                                  <textarea
                                    rows={3}
                                    maxLength={VALIDATION_BOUNDS.comment.textMax}
                                    value={editCommentText}
                                    onChange={(e) => setEditCommentText(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                                  />
                                </label>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={savingComment}
                                    onClick={() => handleSaveCommentEdit(c)}
                                    className="px-3.5 py-1.5 bg-[var(--accent-forest)] text-[var(--accent-forest-contrast)] text-xs font-medium hover:bg-[var(--accent-forest-hover)] disabled:opacity-60 cursor-pointer"
                                  >
                                    {savingComment ? 'Salvando...' : 'Salvar Edição'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEditComment}
                                    className="px-3.5 py-1.5 border border-[var(--border-hairline)] text-[var(--text-muted)] text-xs font-medium hover:text-[var(--text-primary)] cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                                  <span>
                                    <strong className="text-[var(--text-primary)]">{c.authorName}</strong> · {c.authorRelation}
                                  </span>
                                  <span className="font-mono text-[11px] text-[var(--accent-terracotta)]">Pendente</span>
                                </div>
                                <p className="text-sm text-[var(--text-primary)] leading-relaxed">{c.text}</p>
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => handleModerate(c.id, 'approved')}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[var(--accent-forest)] text-[var(--accent-forest-contrast)] text-xs font-medium hover:bg-[var(--accent-forest-hover)] cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Aprovar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => startEditComment(c)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border-hairline)] text-[var(--text-primary)] text-xs font-medium hover:border-[var(--accent-forest-ink)] cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteComment(c.id)}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-[var(--border-hairline)] text-[var(--accent-terracotta)] text-xs font-medium hover:bg-[var(--feedback-error-bg)] cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Excluir
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-serif text-lg font-semibold text-[var(--text-primary)]">
                      Comentários Aprovados ({approvedComments.length})
                    </h3>
                    {approvedComments.length === 0 ? (
                      <p className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-5 text-sm text-[var(--text-muted)]">
                        Ainda não há comentários publicados.
                      </p>
                    ) : (
                      approvedComments.map((c) => {
                        const isEditingThis = editingCommentId === c.id;
                        return (
                          <div key={c.id} className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-5 space-y-3">
                            {isEditingThis ? (
                              <div className="space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <label className="block space-y-1">
                                    <span className="text-xs font-medium text-[var(--text-muted)]">Autor</span>
                                    <input
                                      type="text"
                                      maxLength={VALIDATION_BOUNDS.comment.authorNameMax}
                                      value={editCommentAuthor}
                                      onChange={(e) => setEditCommentAuthor(e.target.value)}
                                      className="w-full px-3 py-2 text-xs bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                                    />
                                  </label>
                                  <label className="block space-y-1">
                                    <span className="text-xs font-medium text-[var(--text-muted)]">Vínculo</span>
                                    <select
                                      value={editCommentRelation}
                                      onChange={(e) => setEditCommentRelation(e.target.value as CommentRelation)}
                                      className="w-full px-3 py-2 text-xs bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                                    >
                                      {VALIDATION_BOUNDS.comment.relations.map((rel) => (
                                        <option key={rel} value={rel}>
                                          {rel}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                                <label className="block space-y-1">
                                  <span className="text-xs font-medium text-[var(--text-muted)]">Mensagem</span>
                                  <textarea
                                    rows={3}
                                    maxLength={VALIDATION_BOUNDS.comment.textMax}
                                    value={editCommentText}
                                    onChange={(e) => setEditCommentText(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                                  />
                                </label>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={savingComment}
                                    onClick={() => handleSaveCommentEdit(c)}
                                    className="px-3.5 py-1.5 bg-[var(--accent-forest)] text-[var(--accent-forest-contrast)] text-xs font-medium hover:bg-[var(--accent-forest-hover)] disabled:opacity-60 cursor-pointer"
                                  >
                                    {savingComment ? 'Salvando...' : 'Salvar Edição'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEditComment}
                                    className="px-3.5 py-1.5 border border-[var(--border-hairline)] text-[var(--text-muted)] text-xs font-medium hover:text-[var(--text-primary)] cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                                  <span>
                                    <strong className="text-[var(--text-primary)]">{c.authorName}</strong> · {c.authorRelation}
                                  </span>
                                  <span className="font-mono text-[11px] text-[var(--accent-forest-ink)] inline-flex items-center gap-1">
                                    <Eye className="w-3 h-3" /> Visível
                                  </span>
                                </div>
                                <p className="text-sm text-[var(--text-primary)] leading-relaxed">{c.text}</p>
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => handleModerate(c.id, 'pending')}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border-hairline)] text-[var(--text-muted)] text-xs font-medium hover:text-[var(--text-primary)] cursor-pointer"
                                  >
                                    <EyeOff className="w-3.5 h-3.5" />
                                    Ocultar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => startEditComment(c)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border-hairline)] text-[var(--text-primary)] text-xs font-medium hover:border-[var(--accent-forest-ink)] cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteComment(c.id)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border-hairline)] text-[var(--accent-terracotta)] text-xs font-medium hover:bg-[var(--feedback-error-bg)] cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Excluir
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Tab 4: Full Editorial Text & Admin Team Settings */}
              {activeTab === 'settings' && (
                <div className="space-y-6">
                  <form
                    onSubmit={handleSaveSettings}
                    className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-6 space-y-6"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-soft)] pb-3">
                      <div>
                        <h3 className="font-serif text-xl font-semibold text-[var(--text-primary)]">
                          Edição Completa de Todos os Trechos do Blog
                        </h3>
                        <p className="text-xs text-[var(--text-muted)]">
                          Personalize marca, capa, nomes e descrições das três guias e seção de comentários.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSettingsForm(DEFAULT_SETTINGS)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Restaurar padrão
                      </button>
                    </div>

                    {/* Section 1: Header & Navigation */}
                    <div className="space-y-4">
                      <h4 className="font-mono text-xs uppercase tracking-widest text-[var(--accent-terracotta)]">
                        Cabeçalho e Navegação
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="block space-y-1.5">
                          <span className="text-xs font-medium text-[var(--text-muted)]">Nome do Blog / Marca</span>
                          <input
                            type="text"
                            required
                            maxLength={VALIDATION_BOUNDS.settings.brandNameMax}
                            value={settingsForm.brandName}
                            onChange={(e) =>
                              setSettingsForm({ ...settingsForm, brandName: e.target.value })
                            }
                            className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                          />
                        </label>

                        <label className="block space-y-1.5">
                          <span className="text-xs font-medium text-[var(--text-muted)]">Link de Comentários no Menu</span>
                          <input
                            type="text"
                            required
                            maxLength={VALIDATION_BOUNDS.settings.navCommentsLabelMax}
                            value={settingsForm.navCommentsLabel}
                            onChange={(e) =>
                              setSettingsForm({ ...settingsForm, navCommentsLabel: e.target.value })
                            }
                            className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                          />
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <label className="block space-y-1.5">
                          <span className="text-xs font-medium text-[var(--text-muted)]">Curso</span>
                          <input
                            type="text"
                            required
                            maxLength={VALIDATION_BOUNDS.settings.courseTitleMax}
                            value={settingsForm.courseTitle}
                            onChange={(e) =>
                              setSettingsForm({ ...settingsForm, courseTitle: e.target.value })
                            }
                            className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                          />
                        </label>

                        <label className="block space-y-1.5">
                          <span className="text-xs font-medium text-[var(--text-muted)]">Habilitação</span>
                          <input
                            type="text"
                            required
                            maxLength={VALIDATION_BOUNDS.settings.degreeLabelMax}
                            value={settingsForm.degreeLabel}
                            onChange={(e) =>
                              setSettingsForm({ ...settingsForm, degreeLabel: e.target.value })
                            }
                            className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                          />
                        </label>

                        <label className="block space-y-1.5">
                          <span className="text-xs font-medium text-[var(--text-muted)]">Turma / Ano</span>
                          <input
                            type="text"
                            required
                            maxLength={VALIDATION_BOUNDS.settings.classYearMax}
                            value={settingsForm.classYear}
                            onChange={(e) =>
                              setSettingsForm({ ...settingsForm, classYear: e.target.value })
                            }
                            className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                          />
                        </label>
                      </div>

                      <label className="block space-y-1.5">
                        <span className="text-xs font-medium text-[var(--text-muted)]">Instituição / Departamento</span>
                        <input
                          type="text"
                          required
                          maxLength={VALIDATION_BOUNDS.settings.institutionMax}
                          value={settingsForm.institution}
                          onChange={(e) =>
                            setSettingsForm({ ...settingsForm, institution: e.target.value })
                          }
                          className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                        />
                      </label>
                    </div>

                    {/* Section 2: Cover, Search & Summary Strip */}
                    <div className="space-y-4 pt-4 border-t border-[var(--border-soft)]">
                      <h4 className="font-mono text-xs uppercase tracking-widest text-[var(--accent-terracotta)]">
                        Capa Principal, Busca e Indicadores
                      </h4>

                      <label className="block space-y-1.5">
                        <span className="text-xs font-medium text-[var(--text-muted)]">Manchete principal da capa</span>
                        <input
                          type="text"
                          required
                          maxLength={VALIDATION_BOUNDS.settings.heroTitleMax}
                          value={settingsForm.heroTitle}
                          onChange={(e) =>
                            setSettingsForm({ ...settingsForm, heroTitle: e.target.value })
                          }
                          className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                        />
                      </label>

                      <label className="block space-y-1.5">
                        <span className="text-xs font-medium text-[var(--text-muted)]">Manifesto de abertura</span>
                        <textarea
                          rows={3}
                          required
                          maxLength={VALIDATION_BOUNDS.settings.introTextMax}
                          value={settingsForm.introText}
                          onChange={(e) =>
                            setSettingsForm({ ...settingsForm, introText: e.target.value })
                          }
                          className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                        />
                      </label>

                      <label className="block space-y-1.5">
                        <span className="text-xs font-medium text-[var(--text-muted)]">Link de chamada da capa</span>
                        <input
                          type="text"
                          required
                          maxLength={VALIDATION_BOUNDS.settings.heroSecondaryCtaMax}
                          value={settingsForm.heroSecondaryCta}
                          onChange={(e) =>
                            setSettingsForm({ ...settingsForm, heroSecondaryCta: e.target.value })
                          }
                          className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                        />
                      </label>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="block space-y-1.5">
                          <span className="text-xs font-medium text-[var(--text-muted)]">Rótulo do indicador de fotos</span>
                          <input
                            type="text"
                            required
                            maxLength={VALIDATION_BOUNDS.settings.statLabelMax}
                            value={settingsForm.statPhotosLabel}
                            onChange={(e) =>
                              setSettingsForm({ ...settingsForm, statPhotosLabel: e.target.value })
                            }
                            className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                          />
                        </label>

                        <label className="block space-y-1.5">
                          <span className="text-xs font-medium text-[var(--text-muted)]">Rótulo do indicador de guias</span>
                          <input
                            type="text"
                            required
                            maxLength={VALIDATION_BOUNDS.settings.statLabelMax}
                            value={settingsForm.statGuidesLabel}
                            onChange={(e) =>
                              setSettingsForm({ ...settingsForm, statGuidesLabel: e.target.value })
                            }
                            className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                          />
                        </label>

                        <label className="block space-y-1.5">
                          <span className="text-xs font-medium text-[var(--text-muted)]">Rótulo do indicador de mensagens</span>
                          <input
                            type="text"
                            required
                            maxLength={VALIDATION_BOUNDS.settings.statLabelMax}
                            value={settingsForm.statCommentsLabel}
                            onChange={(e) =>
                              setSettingsForm({ ...settingsForm, statCommentsLabel: e.target.value })
                            }
                            className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                          />
                        </label>

                        <label className="block space-y-1.5">
                          <span className="text-xs font-medium text-[var(--text-muted)]">Rótulo do indicador de visualizações</span>
                          <input
                            type="text"
                            required
                            maxLength={VALIDATION_BOUNDS.settings.statLabelMax}
                            value={settingsForm.statViewsLabel ?? DEFAULT_SETTINGS.statViewsLabel ?? 'Visualizações'}
                            onChange={(e) =>
                              setSettingsForm({ ...settingsForm, statViewsLabel: e.target.value })
                            }
                            className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                          />
                        </label>

                        <label className="block space-y-1.5 sm:col-span-2">
                          <span className="text-xs font-medium text-[var(--text-muted)]">Rótulo da instituição</span>
                          <input
                            type="text"
                            required
                            maxLength={VALIDATION_BOUNDS.settings.statLabelMax}
                            value={settingsForm.statInstitutionLabel}
                            onChange={(e) =>
                              setSettingsForm({ ...settingsForm, statInstitutionLabel: e.target.value })
                            }
                            className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                          />
                        </label>
                      </div>

                      <label className="block space-y-1.5">
                        <span className="text-xs font-medium text-[var(--text-muted)]">Texto guia da barra de busca</span>
                        <input
                          type="text"
                          required
                          maxLength={VALIDATION_BOUNDS.settings.searchPlaceholderMax}
                          value={settingsForm.searchPlaceholder}
                          onChange={(e) =>
                            setSettingsForm({ ...settingsForm, searchPlaceholder: e.target.value })
                          }
                          className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                        />
                      </label>
                    </div>

                    {/* Section 3: 3 Guides */}
                    <div className="space-y-4 pt-4 border-t border-[var(--border-soft)]">
                      <h4 className="font-mono text-xs uppercase tracking-widest text-[var(--accent-terracotta)]">
                        Textos das Três Guias do Acervo
                      </h4>

                      {(['historico', 'formatura', 'turma'] as PhotoCategory[]).map((cat) => {
                        const base = CATEGORY_META[cat];
                        const guide = settingsForm.guides[cat];
                        return (
                          <div
                            key={cat}
                            className="p-4 bg-[var(--bg-canvas)] border border-[var(--border-hairline)] space-y-3"
                          >
                            <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--accent-forest-ink)]">
                              Guia · {base.shortLabel}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <label className="block space-y-1">
                                <span className="text-xs font-medium text-[var(--text-muted)]">Índice / Prancha</span>
                                <input
                                  type="text"
                                  required
                                  maxLength={VALIDATION_BOUNDS.settings.guideRomanIndexMax}
                                  value={guide.romanIndex}
                                  onChange={(e) =>
                                    updateGuideField(cat, 'romanIndex', e.target.value)
                                  }
                                  className="w-full px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                                />
                              </label>
                              <label className="block space-y-1">
                                <span className="text-xs font-medium text-[var(--text-muted)]">Nome curto (menu/aba)</span>
                                <input
                                  type="text"
                                  required
                                  maxLength={VALIDATION_BOUNDS.settings.guideShortLabelMax}
                                  value={guide.shortLabel}
                                  onChange={(e) =>
                                    updateGuideField(cat, 'shortLabel', e.target.value)
                                  }
                                  className="w-full px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                                />
                              </label>
                              <label className="block space-y-1">
                                <span className="text-xs font-medium text-[var(--text-muted)]">Título da guia</span>
                                <input
                                  type="text"
                                  required
                                  maxLength={VALIDATION_BOUNDS.settings.guideLabelMax}
                                  value={guide.label}
                                  onChange={(e) => updateGuideField(cat, 'label', e.target.value)}
                                  className="w-full px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                                />
                              </label>
                            </div>
                            <label className="block space-y-1">
                              <span className="text-xs font-medium text-[var(--text-muted)]">Subtítulo temático</span>
                              <input
                                type="text"
                                required
                                maxLength={VALIDATION_BOUNDS.settings.guideSubtitleMax}
                                value={guide.subtitle}
                                onChange={(e) => updateGuideField(cat, 'subtitle', e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                              />
                            </label>
                            <label className="block space-y-1">
                              <span className="text-xs font-medium text-[var(--text-muted)]">Descrição de apresentação</span>
                              <textarea
                                rows={2}
                                required
                                maxLength={VALIDATION_BOUNDS.settings.guideDescriptionMax}
                                value={guide.description}
                                onChange={(e) =>
                                  updateGuideField(cat, 'description', e.target.value)
                                }
                                className="w-full px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                              />
                            </label>
                          </div>
                        );
                      })}
                    </div>

                    {/* Section 4: Comments Wall, Sharing & Footer */}
                    <div className="space-y-4 pt-4 border-t border-[var(--border-soft)]">
                      <h4 className="font-mono text-xs uppercase tracking-widest text-[var(--accent-terracotta)]">
                        Mural, Compartilhamento e Rodapé
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="block space-y-1.5">
                          <span className="text-xs font-medium text-[var(--text-muted)]">Sobretítulo do mural</span>
                          <input
                            type="text"
                            required
                            maxLength={VALIDATION_BOUNDS.settings.commentsKickerMax}
                            value={settingsForm.commentsKicker}
                            onChange={(e) =>
                              setSettingsForm({ ...settingsForm, commentsKicker: e.target.value })
                            }
                            className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                          />
                        </label>
                        <label className="block space-y-1.5">
                          <span className="text-xs font-medium text-[var(--text-muted)]">Título do mural</span>
                          <input
                            type="text"
                            required
                            maxLength={VALIDATION_BOUNDS.settings.commentsTitleMax}
                            value={settingsForm.commentsTitle}
                            onChange={(e) =>
                              setSettingsForm({ ...settingsForm, commentsTitle: e.target.value })
                            }
                            className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                          />
                        </label>
                      </div>

                      <label className="block space-y-1.5">
                        <span className="text-xs font-medium text-[var(--text-muted)]">Texto convite para comentários</span>
                        <textarea
                          rows={2}
                          required
                          maxLength={VALIDATION_BOUNDS.settings.commentsIntroMax}
                          value={settingsForm.commentsIntro}
                          onChange={(e) =>
                            setSettingsForm({ ...settingsForm, commentsIntro: e.target.value })
                          }
                          className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                        />
                      </label>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="block space-y-1.5">
                          <span className="text-xs font-medium text-[var(--text-muted)]">Título da caixa de compartilhamento</span>
                          <input
                            type="text"
                            required
                            maxLength={VALIDATION_BOUNDS.settings.shareTitleMax}
                            value={settingsForm.shareTitle}
                            onChange={(e) =>
                              setSettingsForm({ ...settingsForm, shareTitle: e.target.value })
                            }
                            className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                          />
                        </label>

                        <label className="block space-y-1.5">
                          <span className="text-xs font-medium text-[var(--text-muted)]">Título do formulário de comentário</span>
                          <input
                            type="text"
                            required
                            maxLength={VALIDATION_BOUNDS.settings.commentFormTitleMax}
                            value={settingsForm.commentFormTitle}
                            onChange={(e) =>
                              setSettingsForm({ ...settingsForm, commentFormTitle: e.target.value })
                            }
                            className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                          />
                        </label>
                      </div>

                      <label className="block space-y-1.5">
                        <span className="text-xs font-medium text-[var(--text-muted)]">Descrição de compartilhamento</span>
                        <textarea
                          rows={2}
                          required
                          maxLength={VALIDATION_BOUNDS.settings.shareDescriptionMax}
                          value={settingsForm.shareDescription}
                          onChange={(e) =>
                            setSettingsForm({ ...settingsForm, shareDescription: e.target.value })
                          }
                          className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                        />
                      </label>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="block space-y-1.5">
                          <span className="text-xs font-medium text-[var(--text-muted)]">Aviso abaixo do formulário</span>
                          <input
                            type="text"
                            required
                            maxLength={VALIDATION_BOUNDS.settings.commentFormNoticeMax}
                            value={settingsForm.commentFormNotice}
                            onChange={(e) =>
                              setSettingsForm({ ...settingsForm, commentFormNotice: e.target.value })
                            }
                            className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                          />
                        </label>

                        <label className="block space-y-1.5">
                          <span className="text-xs font-medium text-[var(--text-muted)]">
                            Nota extra do rodapé <span className="text-[var(--text-subtle)] font-normal">(opcional)</span>
                          </span>
                          <input
                            type="text"
                            maxLength={VALIDATION_BOUNDS.settings.footerNoteMax}
                            value={settingsForm.footerNote}
                            onChange={(e) =>
                              setSettingsForm({ ...settingsForm, footerNote: e.target.value })
                            }
                            placeholder="Ex.: Homenagem especial aos professores orientadores"
                            className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                          />
                        </label>
                      </div>
                    </div>

                    {settingsError && (
                      <p className="text-xs bg-[var(--feedback-error-bg)] border border-[var(--feedback-error-border)] text-[var(--feedback-error-text)] p-3">
                        {settingsError}
                      </p>
                    )}

                    <div className="flex justify-end pt-2 border-t border-[var(--border-soft)]">
                      <button
                        type="submit"
                        disabled={savingSettings}
                        className="px-5 py-2.5 bg-[var(--accent-forest)] text-[var(--accent-forest-contrast)] text-sm font-medium hover:bg-[var(--accent-forest-hover)] disabled:opacity-60 transition-colors cursor-pointer"
                      >
                        {savingSettings ? 'Salvando...' : 'Salvar Todos os Textos do Blog'}
                      </button>
                    </div>
                  </form>

                  {/* Admin Collaborators Section (only for Bootstrapped Admin) */}
                  {isBootstrappedAdmin && (
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-6 space-y-5">
                      <div className="border-b border-[var(--border-soft)] pb-3">
                        <h3 className="font-serif text-xl font-semibold text-[var(--text-primary)]">
                          Administradores Adicionais
                        </h3>
                        <p className="text-xs text-[var(--text-muted)]">
                          Adicione colegas apenas pelo e-mail. Quando entrarem na Área Admin, o acesso é vinculado automaticamente.
                        </p>
                      </div>

                      <form onSubmit={handleAddAdmin} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="email"
                          required
                          maxLength={120}
                          value={newAdminEmail}
                          onChange={(e) => setNewAdminEmail(e.target.value)}
                          placeholder="E-mail do colega"
                          className="px-3 py-2 text-xs bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                        />
                        <div className="flex gap-2">
                          <input
                            type="text"
                            required
                            maxLength={120}
                            value={newAdminName}
                            onChange={(e) => setNewAdminName(e.target.value)}
                            placeholder="Nome completo"
                            className="flex-1 min-w-0 px-3 py-2 text-xs bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
                          />
                          <button
                            type="submit"
                            disabled={addingAdmin}
                            className="inline-flex items-center gap-1 px-3 py-2 bg-[var(--accent-forest)] text-[var(--accent-forest-contrast)] text-xs font-medium hover:bg-[var(--accent-forest-hover)] disabled:opacity-60 cursor-pointer shrink-0"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            {addingAdmin ? 'Salvando...' : 'Adicionar'}
                          </button>
                        </div>
                      </form>

                      {(adminsList.length > 0 || adminInvitesList.length > 0) && (
                        <div className="divide-y divide-[var(--border-soft)] border border-[var(--border-hairline)]">
                          {adminsList.map((adm) => (
                            <div
                              key={adm.uid}
                              className="p-3 flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="min-w-0">
                                <p className="font-medium text-[var(--text-primary)]">{adm.displayName}</p>
                                <p className="text-[var(--text-muted)] truncate">
                                  {adm.email} · <span className="font-mono text-[var(--accent-forest-ink)]">UID vinculado</span>
                                </p>
                              </div>
                              {adm.uid !== user.id && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAdmin(adm.uid, adm.email)}
                                  className="px-2.5 py-1 border border-[var(--border-hairline)] text-[var(--accent-terracotta)] hover:bg-[var(--feedback-error-bg)] cursor-pointer shrink-0"
                                >
                                  Remover
                                </button>
                              )}
                            </div>
                          ))}
                          {adminInvitesList
                            .filter(
                              (inv) =>
                                !adminsList.some(
                                  (adm) => adm.email.trim().toLowerCase() === inv.email.trim().toLowerCase()
                                )
                            )
                            .map((inv) => (
                              <div
                                key={inv.id}
                                className="p-3 flex items-center justify-between gap-3 text-xs"
                              >
                                <div className="min-w-0">
                                  <p className="font-medium text-[var(--text-primary)]">{inv.displayName}</p>
                                  <p className="text-[var(--text-muted)] truncate">
                                    {inv.email} · <span className="font-mono text-[var(--accent-terracotta)]">Aguardando primeiro acesso</span>
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveInvite(inv.id)}
                                  className="px-2.5 py-1 border border-[var(--border-hairline)] text-[var(--accent-terracotta)] hover:bg-[var(--feedback-error-bg)] cursor-pointer shrink-0"
                                >
                                  Remover
                                </button>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
