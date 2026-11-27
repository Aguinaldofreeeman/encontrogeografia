import { BookOpen, Compass, FileDown, GraduationCap, Home, Landmark, MapPin, Menu, MessageSquare, Moon, Search, ShieldCheck, Sun, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { AdminDrawer } from './components/AdminDrawer';
import { CommentsSection } from './components/CommentsSection';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PhotoCard } from './components/PhotoCard';
import { PhotoLightbox } from './components/PhotoLightbox';
import { ShareBar } from './components/ShareBar';
import { CATEGORY_META, DEFAULT_SEED_PHOTOS, DEFAULT_SETTINGS } from './data/seedData';
import { useTheme } from './hooks/useTheme';
import { exportAlbumToPdf } from './lib/pdfExport';
import { isBootstrappedAdminEmail, supabase } from './lib/supabase';
import {
  checkIsAdminUser,
  recordHomePageView,
  subscribeAlbumSettings,
  subscribeComments,
  subscribeHomePageViews,
  subscribePhotos,
} from './services/blogService';
import { AlbumSettings, CommentItem, PhotoCategory, PhotoItem } from './types';

type AppView = 'inicio' | PhotoCategory | 'comentarios';

const CATEGORY_ORDER: PhotoCategory[] = ['historico', 'formatura', 'turma', 'professores'];

const CATEGORY_ICONS: Record<PhotoCategory, typeof Landmark> = {
  historico: Landmark,
  formatura: GraduationCap,
  turma: Users,
  professores: BookOpen,
};

function AlbumContent() {
  const { isDark, toggleTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBootstrappedAdmin, setIsBootstrappedAdmin] = useState(false);

  const [remotePhotos, setRemotePhotos] = useState<PhotoItem[]>([]);
  const [hasRemotePhotos, setHasRemotePhotos] = useState(false);
  const [photosLoading, setPhotosLoading] = useState(true);

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [settings, setSettings] = useState<AlbumSettings>(DEFAULT_SETTINGS);
  const [totalViews, setTotalViews] = useState<number | null>(null);

  const [activeView, setActiveView] = useState<AppView>('inicio');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [heroImgError, setHeroImgError] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const activeCategory: PhotoCategory = activeView && (CATEGORY_ORDER as readonly string[]).includes(activeView)
    ? (activeView as PhotoCategory)
    : 'historico';
  const isCategoryView = CATEGORY_ORDER.includes(activeView as PhotoCategory);

  const showToast = (msg: string) => setToast(msg);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    void recordHomePageView().catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (params.get('type') === 'recovery' || hash.get('type') === 'recovery') {
      setPasswordRecovery(true);
      setAdminOpen(true);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const syncUser = async (currentUser: User | null) => {
      if (!mounted) return;
      setUser(currentUser);
      if (!currentUser) {
        setIsAdmin(false);
        setIsBootstrappedAdmin(false);
        return;
      }
      const email = currentUser.email ?? null;
      const bootstrapped = Boolean(currentUser.email_confirmed_at) && isBootstrappedAdminEmail(email);
      setIsBootstrappedAdmin(bootstrapped);
      try {
        const allowed = await checkIsAdminUser(
          currentUser.id,
          email,
          Boolean(currentUser.email_confirmed_at),
          (currentUser.user_metadata?.full_name as string | undefined) || currentUser.email || null
        );
        if (mounted) setIsAdmin(allowed);
      } catch {
        if (mounted) setIsAdmin(bootstrapped);
      }
    };

    void supabase.auth.getSession().then(({ data }) => syncUser(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
        setAdminOpen(true);
      }
      void syncUser(session?.user ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setPhotosLoading(true);
    const unsubPhotos = subscribePhotos(
      isBootstrappedAdmin,
      (items, hasDocs) => {
        setRemotePhotos(items);
        setHasRemotePhotos(hasDocs);
        setPhotosLoading(false);
      },
      () => setPhotosLoading(false)
    );

    const unsubComments = subscribeComments(isBootstrappedAdmin, setComments, () => {});
    const unsubSettings = subscribeAlbumSettings(setSettings, () => {});
    const unsubViews = subscribeHomePageViews(setTotalViews, () => {});

    return () => {
      unsubPhotos();
      unsubComments();
      unsubSettings();
      unsubViews();
    };
  }, [isBootstrappedAdmin]);

  const activePhotos: PhotoItem[] = useMemo(() => {
    if (hasRemotePhotos) return remotePhotos;
    return DEFAULT_SEED_PHOTOS.map((item, idx) => ({
      ...item,
      createdAtMs: Date.now() - idx * 1000,
      isSeedPreview: true,
    }));
  }, [hasRemotePhotos, remotePhotos]);

  const publicPhotos = useMemo(() => activePhotos.filter((p) => p.visibility === 'public'), [activePhotos]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const guiaParam = params.get('guia') as PhotoCategory | null;
    const fotoParam = params.get('foto');

    if (guiaParam && CATEGORY_ORDER.includes(guiaParam)) {
      setActiveView(guiaParam);
    } else if (window.location.hash === '#mural-comentarios') {
      setActiveView('comentarios');
    }

    if (fotoParam && publicPhotos.length > 0) {
      const match = publicPhotos.find((p) => p.id === fotoParam);
      if (match) {
        setActiveView(match.category);
        setSelectedPhoto(match);
      }
    }
  }, [publicPhotos]);

  const featuredPhoto = useMemo(() => {
    return (
      publicPhotos.find((p) => p.featured) ||
      publicPhotos[0] || { ...DEFAULT_SEED_PHOTOS[0], createdAtMs: Date.now(), isSeedPreview: true }
    );
  }, [publicPhotos]);

  const categoryPhotos = useMemo(() => publicPhotos.filter((p) => p.category === activeCategory), [publicPhotos, activeCategory]);
  const availableYears = useMemo(() => Array.from(new Set(categoryPhotos.map((p) => p.yearLabel))), [categoryPhotos]);

  const filteredPhotos = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return categoryPhotos.filter((p) => {
      if (yearFilter !== 'all' && p.yearLabel !== yearFilter) return false;
      if (!normalizedQuery) return true;
      const normalizedTitle = p.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const normalizedLocation = p.location.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return normalizedTitle.includes(normalizedQuery) || normalizedLocation.includes(normalizedQuery);
    });
  }, [categoryPhotos, yearFilter, searchQuery]);

  const approvedComments = useMemo(() => comments.filter((c) => c.status === 'approved'), [comments]);
  const albumWallComments = useMemo(() => approvedComments.filter((c) => c.targetType === 'album'), [approvedComments]);
  const pendingCount = useMemo(() => comments.filter((c) => c.status === 'pending').length, [comments]);

  const handleSelectView = (view: AppView) => {
    setActiveView(view);
    setYearFilter('all');
    setSearchQuery('');
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExportPdf = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      const count = await exportAlbumToPdf(publicPhotos, settings);
      showToast(`Álbum editorial em PDF gerado (${count} fotografias públicas).`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível gerar o PDF do álbum.');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleSetNewPassword = async () => {
    if (newPassword.length < 6) { showToast('A senha deve ter ao menos 6 caracteres.'); return; }
    if (newPassword !== newPasswordConfirm) { showToast('As senhas não coincidem.'); return; }
    setPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordRecovery(false);
      setNewPassword('');
      setNewPasswordConfirm('');
      const clean = new URL(window.location.href);
      clean.searchParams.delete('code');
      clean.searchParams.delete('type');
      window.history.replaceState({}, document.title, clean.toString());
      showToast('Senha atualizada com sucesso.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao atualizar senha.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const activeCategoryMeta = CATEGORY_META[activeCategory];
  const activeGuide = settings.guides?.[activeCategory] || activeCategoryMeta;
  const currentViewTitle = useMemo(() => {
    if (activeView === 'inicio') return 'Início';
    if (activeView === 'comentarios') return settings.navCommentsLabel;
    return settings.guides?.[activeView]?.label || CATEGORY_META[activeView].label;
  }, [activeView, settings]);

  const navItems: { id: AppView; label: string; icon: typeof Home; count?: number }[] = [
    { id: 'inicio', label: 'Início', icon: Home },
    ...CATEGORY_ORDER.map((cat) => ({
      id: cat as AppView,
      label: settings.guides?.[cat]?.shortLabel || CATEGORY_META[cat].shortLabel,
      icon: CATEGORY_ICONS[cat],
      count: publicPhotos.filter((p) => p.category === cat).length,
    })),
    { id: 'comentarios', label: settings.navCommentsLabel || 'Comentários', icon: MessageSquare, count: albumWallComments.length },
  ];

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-[var(--sidebar-bg)] text-[var(--sidebar-text)]">
      <div className="px-5 py-5 border-b border-[var(--sidebar-border)] flex items-center justify-between gap-3">
        <button type="button" onClick={() => handleSelectView('inicio')} className="flex items-center gap-3 text-left min-w-0 cursor-pointer group">
          <span className="w-9 h-9 rounded-lg bg-white/12 border border-white/15 flex items-center justify-center shrink-0">
            <Compass className="w-5 h-5 text-[#F59E0B]" />
          </span>
          <div className="min-w-0">
            <strong className="block font-serif text-base font-semibold leading-tight text-white truncate">{settings.brandName}</strong>
            <span className="block text-[11px] text-[var(--sidebar-text-muted)] truncate mt-0.5">{settings.courseTitle} · 1996</span>
          </div>
        </button>
        <button type="button" aria-label="Fechar menu" onClick={() => setMobileMenuOpen(false)} className="md:hidden p-1.5 rounded-lg text-[var(--sidebar-text-muted)] hover:text-white hover:bg-[var(--sidebar-hover)] cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
      <nav aria-label="Menu principal do álbum" className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button key={item.id} type="button" aria-current={active ? 'page' : undefined} onClick={() => handleSelectView(item.id)} className={`relative w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${active ? 'bg-[var(--sidebar-active-bg)] text-white font-semibold' : 'text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover)] hover:text-white'}`}>
              {active && <span aria-hidden="true" className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[var(--sidebar-active-bar)]" />}
              <span className="flex items-center gap-3 min-w-0">
                <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-white' : 'text-[var(--sidebar-text-muted)]'}`} />
                <span className="truncate">{item.label}</span>
              </span>
              {typeof item.count === 'number' && <span className={`font-mono text-[11px] tabular-nums shrink-0 ${active ? 'text-white/90' : 'text-[var(--sidebar-text-muted)]/80'}`}>{String(item.count).padStart(2, '0')}</span>}
            </button>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t border-[var(--sidebar-border)] text-[11px] text-[var(--sidebar-text-muted)] space-y-1">
        <p className="font-medium text-white/90 truncate">{settings.degreeLabel}</p>
        <p className="truncate opacity-80">{settings.institution}</p>
      </div>
    </div>
  );

  return (
    <div id="topo" className="min-h-screen flex bg-[var(--bg-canvas)] text-[var(--text-primary)] transition-colors duration-200">
      <aside className="hidden md:flex md:w-64 md:shrink-0 md:sticky md:top-0 md:h-screen z-30 border-r border-[var(--border-hairline)]"><div className="w-full h-full">{renderSidebarContent()}</div></aside>
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex bg-[var(--bg-backdrop-drawer)] backdrop-blur-xs" onClick={(e) => { if (e.target === e.currentTarget) setMobileMenuOpen(false); }}>
          <aside className="w-72 max-w-[82vw] h-full shadow-xl">{renderSidebarContent()}</aside>
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-[var(--bg-header)] backdrop-blur-xs border-b border-[var(--border-hairline)]">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button type="button" aria-label="Abrir menu lateral" onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] hover:border-[var(--accent-forest-ink)] transition-colors cursor-pointer shrink-0"><Menu className="w-4 h-4" /></button>
              <span className="font-serif text-lg sm:text-xl font-semibold text-[var(--text-primary)] truncate">{currentViewTitle}</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              <button type="button" onClick={toggleTheme} aria-pressed={isDark} aria-label={isDark ? 'Alternar para modo claro' : 'Alternar para modo noturno de leitura'} title={isDark ? 'Modo claro' : 'Modo noturno de leitura'} className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] hover:border-[var(--accent-forest-ink)] hover:text-[var(--accent-forest-ink)] text-[11px] sm:text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0">
                {isDark ? <Sun className="w-3.5 h-3.5 text-[var(--accent-terracotta)]" /> : <Moon className="w-3.5 h-3.5 text-[var(--accent-ocean-ink)]" />}
                <span className="hidden lg:inline">{isDark ? 'Claro' : 'Noturno'}</span>
              </button>
              <button type="button" disabled={exportingPdf || photosLoading || publicPhotos.length === 0} onClick={handleExportPdf} className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] hover:border-[var(--accent-forest-ink)] hover:text-[var(--accent-forest-ink)] disabled:opacity-55 text-[11px] sm:text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap shrink-0">
                <FileDown className="w-3.5 h-3.5 text-[var(--accent-terracotta)]" />
                <span className="hidden sm:inline">{exportingPdf ? 'Gerando PDF...' : 'Exportar Álbum em PDF'}</span>
                <span className="sm:hidden">{exportingPdf ? 'PDF...' : 'PDF'}</span>
              </button>
              <button type="button" onClick={() => setAdminOpen(true)} className="inline-flex items-center gap-1.5 px-2.5 sm:px-4 py-2 bg-[var(--accent-forest)] text-[var(--accent-forest-contrast)] text-[11px] sm:text-xs font-medium hover:bg-[var(--accent-forest-hover)] transition-colors cursor-pointer whitespace-nowrap shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
                {isAdmin ? `Painel Admin${pendingCount > 0 ? ` (${pendingCount})` : ''}` : 'Área Admin'}
              </button>
            </div>
          </div>
        </header>
        <main className="flex-1">
          <div key={activeView} className="animate-view-enter">
            {activeView === 'inicio' && (
              <section className="topographic-grid-bg">
                <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-stretch">
                    <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
                      <div className="space-y-4">
                        <p className="font-mono text-xs uppercase tracking-widest text-[var(--accent-terracotta)]">LICENCIATURA E BACHARELADO EM GEOGRAFIA - 1996</p>
                        <h1 className="font-serif text-3xl sm:text-4xl lg:text-[3rem] font-semibold text-[var(--text-primary)] leading-[1.06] tracking-tight">{settings.heroTitle}</h1>
                        <p className="text-sm sm:text-base text-[var(--text-muted)] leading-relaxed max-w-xl">{settings.introText}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 pt-1">
                        <button type="button" onClick={() => handleSelectView('comentarios')} className="inline-flex items-center px-5 py-2.5 bg-[var(--accent-forest)] text-[var(--accent-forest-contrast)] text-sm font-medium hover:bg-[var(--accent-forest-hover)] transition-colors cursor-pointer whitespace-nowrap">{settings.heroSecondaryCta}</button>
                      </div>
                    </div>
                    <div className="lg:col-span-6">
                      <div onClick={() => setSelectedPhoto(featuredPhoto)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPhoto(featuredPhoto); } }} className="relative h-full min-h-[240px] lg:min-h-[340px] border border-[var(--border-hairline)] bg-[var(--bg-surface-muted)] overflow-hidden cursor-pointer group">
                        {heroImgError ? (
                          <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center text-[var(--text-muted)]"><Compass className="w-8 h-8 mb-3 opacity-60" /><p className="font-serif text-xl text-[var(--text-primary)]">{featuredPhoto.title}</p></div>
                        ) : (
                          <img src={featuredPhoto.imageUrl} alt={featuredPhoto.title} referrerPolicy="no-referrer" onError={() => setHeroImgError(true)} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
                        )}
                        {featuredPhoto.photographer.trim() && !heroImgError && <span className="pointer-events-none select-none absolute top-3 right-3 font-mono text-[11px] tracking-wide text-[#F9F7F1]/60 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">© {featuredPhoto.photographer.trim()}</span>}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent p-6 text-[#F9F7F1]">
                          <p className="font-mono text-[11px] uppercase tracking-widest text-[#E5DFD3] mb-1">{featuredPhoto.location}</p>
                          <p className="font-serif text-xl sm:text-2xl font-medium leading-snug">{featuredPhoto.title}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-8 pt-6 border-t border-[var(--border-hairline)] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
                    <div><p className="font-mono text-2xl font-medium text-[var(--text-primary)] tabular-nums">{String(publicPhotos.length).padStart(2, '0')}</p><p className="text-xs text-[var(--text-muted)] mt-1">{settings.statPhotosLabel}</p></div>
                    <div><p className="font-mono text-2xl font-medium text-[var(--text-primary)] tabular-nums">04</p><p className="text-xs text-[var(--text-muted)] mt-1">{settings.statGuidesLabel}</p></div>
                    <div><p className="font-mono text-2xl font-medium text-[var(--text-primary)] tabular-nums">{String(approvedComments.length).padStart(2, '0')}</p><p className="text-xs text-[var(--text-muted)] mt-1">{settings.statCommentsLabel}</p></div>
                    <div><p className="font-mono text-2xl font-medium text-[var(--text-primary)] tabular-nums">{totalViews === null ? '—' : String(totalViews).padStart(2, '0')}</p><p className="text-xs text-[var(--text-muted)] mt-1">{settings.statViewsLabel || DEFAULT_SETTINGS.statViewsLabel}</p></div>
                    <div className="col-span-2 sm:col-span-2 lg:col-span-1"><p className="font-mono text-sm font-medium text-[var(--accent-forest-ink)] flex items-center gap-1.5 pt-1"><MapPin className="w-4 h-4 shrink-0" /><span className="truncate">{settings.institution}</span></p><p className="text-xs text-[var(--text-muted)] mt-1.5">{settings.statInstitutionLabel}</p></div>
                  </div>
                </div>
              </section>
            )}

            {isCategoryView && (
              <section className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
                <div className="border-b border-[var(--border-hairline)] pb-6 space-y-2">
                  <p className="font-mono text-xs uppercase tracking-widest text-[var(--accent-terracotta)]">{activeGuide.romanIndex || activeCategoryMeta.romanIndex} · {activeGuide.subtitle}</p>
                  <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[var(--text-primary)]">{activeGuide.label}</h1>
                  <p className="text-sm sm:text-base text-[var(--text-muted)] leading-relaxed max-w-3xl">{activeGuide.description}</p>
                </div>
                <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-md">
                    <Search aria-hidden="true" className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input id="archive-quick-search" type="text" aria-label="Buscar fotos por título ou localização" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={settings.searchPlaceholder} className="w-full pl-9 pr-9 py-2 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-forest-ink)] transition-colors" />
                    {searchQuery && <button type="button" aria-label="Limpar busca" onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"><X className="w-4 h-4" /></button>}
                  </div>
                  {availableYears.length > 1 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button type="button" onClick={() => setYearFilter('all')} className={`px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${yearFilter === 'all' ? 'bg-[var(--btn-active-bg)] text-[var(--btn-active-text)] border-[var(--btn-active-bg)]' : 'bg-[var(--bg-canvas)] text-[var(--text-muted)] border-[var(--border-hairline)] hover:border-[var(--accent-forest-ink)]'}`}>Todos</button>
                      {availableYears.map((yr) => <button key={yr} type="button" onClick={() => setYearFilter(yr)} className={`px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${yearFilter === yr ? 'bg-[var(--btn-active-bg)] text-[var(--btn-active-text)] border-[var(--btn-active-bg)]' : 'bg-[var(--bg-canvas)] text-[var(--text-muted)] border-[var(--border-hairline)] hover:border-[var(--accent-forest-ink)]'}`}>{yr}</button>)}
                    </div>
                  )}
                </div>
                {(searchQuery.trim() !== '' || yearFilter !== 'all') && (
                  <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
                    <span className="font-mono tabular-nums">{filteredPhotos.length} {filteredPhotos.length === 1 ? 'registro encontrado' : 'registros encontrados'}{searchQuery.trim() !== '' ? ` para “${searchQuery.trim()}”` : ''}</span>
                    <button type="button" onClick={() => { setSearchQuery(''); setYearFilter('all'); }} className="text-[var(--accent-forest-ink)] font-medium hover:underline cursor-pointer whitespace-nowrap">Limpar filtros</button>
                  </div>
                )}
                {photosLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{[1, 2, 3, 4].map((item) => <div key={item} className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] h-80 animate-pulse" />)}</div>
                ) : filteredPhotos.length === 0 ? (
                  searchQuery.trim() !== '' || yearFilter !== 'all' ? (
                    <div className="bg-[var(--bg-surface)] border border-dashed border-[var(--border-hairline)] p-12 text-center space-y-4">
                      <Search className="w-7 h-7 text-[var(--text-muted)] mx-auto" />
                      <h2 className="font-serif text-2xl font-semibold text-[var(--text-primary)]">Nenhuma fotografia encontrada com esses critérios</h2>
                      <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">Não encontramos registros em {activeGuide.label.toLowerCase()} correspondentes à busca atual. Tente outro termo de título ou localização.</p>
                      <button type="button" onClick={() => { setSearchQuery(''); setYearFilter('all'); }} className="px-4 py-2 bg-[var(--accent-forest)] text-[var(--accent-forest-contrast)] text-xs font-medium hover:bg-[var(--accent-forest-hover)] transition-colors cursor-pointer whitespace-nowrap">Mostrar todas as fotos da guia</button>
                    </div>
                  ) : (
                    <div className="bg-[var(--bg-surface)] border border-dashed border-[var(--border-hairline)] p-12 text-center space-y-3">
                      <Compass className="w-7 h-7 text-[var(--text-muted)] mx-auto" />
                      <h2 className="font-serif text-2xl font-semibold text-[var(--text-primary)]">Nenhuma fotografia publicada nesta guia ainda</h2>
                      <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">O administrador pode adicionar novos registros de {activeGuide.label.toLowerCase()} pelo botão Área Admin no topo da página.</p>
                    </div>
                  )
                ) : (
                  <div className="space-y-6">
                    <PhotoCard photo={filteredPhotos[0]} featuredLayout commentCount={approvedComments.filter((c) => c.targetType === 'photo' && c.photoId === filteredPhotos[0].id).length} onOpen={setSelectedPhoto} />
                    {filteredPhotos.length > 1 && <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{filteredPhotos.slice(1).map((item) => <PhotoCard key={item.id} photo={item} commentCount={approvedComments.filter((c) => c.targetType === 'photo' && c.photoId === item.id).length} onOpen={setSelectedPhoto} />)}</div>}
                  </div>
                )}
              </section>
            )}

            {activeView === 'comentarios' && (
              <section className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-8">
                <div className="border-b border-[var(--border-hairline)] pb-6 space-y-2">
                  <p className="font-mono text-xs uppercase tracking-widest text-[var(--accent-terracotta)]">{settings.commentsKicker}</p>
                  <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[var(--text-primary)]">{settings.commentsTitle}</h1>
                  <p className="text-sm sm:text-base text-[var(--text-muted)] leading-relaxed max-w-3xl">{settings.commentsIntro}</p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  <div className="lg:col-span-5 bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-6 space-y-4">
                    <h2 className="font-serif text-xl font-semibold text-[var(--text-primary)]">{settings.shareTitle}</h2>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">{settings.shareDescription}</p>
                    <ShareBar title={`${settings.brandName} — ${settings.courseTitle} (${settings.classYear})`} description={`${settings.degreeLabel} · Memórias históricas, formatura e fotos da turma`} category={activeCategory} onNotify={showToast} />
                  </div>
                  <div className="lg:col-span-7">
                    <CommentsSection comments={albumWallComments} photoId="album" targetType="album" formTitle={settings.commentFormTitle} formNotice={settings.commentFormNotice} onNotify={showToast} />
                  </div>
                </div>
              </section>
            )}
          </div>
        </main>
        <footer className="bg-[var(--bg-canvas)] border-t border-[var(--border-hairline)]">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
            <div className="space-y-1">
              <p className="font-serif text-base font-semibold text-[var(--text-primary)]">{settings.courseTitle} — {settings.degreeLabel}</p>
              <p>{settings.institution} · 1996</p>
              {settings.footerNote.trim() !== '' && <p className="text-[var(--text-subtle)]">{settings.footerNote}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-5">
              <button type="button" onClick={() => handleSelectView('inicio')} className="hover:text-[var(--accent-forest-ink)] transition-colors cursor-pointer">Início</button>
              <button type="button" onClick={() => handleSelectView('comentarios')} className="hover:text-[var(--accent-forest-ink)] transition-colors cursor-pointer">{settings.navCommentsLabel}</button>
              <button type="button" onClick={toggleTheme} className="hover:text-[var(--accent-forest-ink)] transition-colors cursor-pointer">{isDark ? 'Modo Claro' : 'Modo Noturno'}</button>
              <button type="button" onClick={() => setAdminOpen(true)} className="hover:text-[var(--accent-forest-ink)] transition-colors cursor-pointer">Área Admin</button>
            </div>
          </div>
        </footer>
      </div>

      {passwordRecovery && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Definir nova senha">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="space-y-1">
              <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--accent-forest-ink)]">Recuperação de acesso</p>
              <h3 className="font-serif text-2xl font-semibold text-[var(--text-primary)]">Definir nova senha</h3>
              <p className="text-sm text-[var(--text-muted)]">Digite sua nova senha para acessar o painel administrativo.</p>
            </div>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nova senha (mín. 6 caracteres)"
              className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
            />
            <input
              type="password"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              placeholder="Confirmar nova senha"
              className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-forest-ink)]"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setPasswordRecovery(false); setNewPassword(''); setNewPasswordConfirm(''); }}
                className="flex-1 px-4 py-2.5 text-sm border border-[var(--border-hairline)] text-[var(--text-muted)] hover:border-[var(--accent-forest-ink)] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSetNewPassword}
                disabled={passwordSaving}
                className="flex-1 px-4 py-2.5 text-sm bg-[var(--accent-forest)] text-[var(--accent-forest-contrast)] font-medium hover:bg-[var(--accent-forest-hover)] disabled:opacity-60 transition-colors cursor-pointer"
              >
                {passwordSaving ? 'Salvando...' : 'Salvar senha'}
              </button>
            </div>
          </div>
        </div>
      )}
      <PhotoLightbox photo={selectedPhoto} photosInScope={categoryPhotos} comments={approvedComments} settings={settings} onClose={() => setSelectedPhoto(null)} onSelectPhoto={(next) => setSelectedPhoto(next)} onNotify={showToast} />
      <AdminDrawer isOpen={adminOpen} onClose={() => setAdminOpen(false)} user={user} isAdmin={isAdmin} isBootstrappedAdmin={isBootstrappedAdmin} photos={activePhotos} hasRemotePhotos={hasRemotePhotos} comments={comments} settings={settings} onNotify={showToast} />
      {toast && <div role="status" className="fixed bottom-5 right-5 z-50 bg-[var(--bg-toast)] text-[var(--text-toast)] px-4 py-3 text-xs font-medium border border-[var(--border-hairline)] shadow-lg max-w-sm">{toast}</div>}
    </div>
  );
}

export default function App() {
  return <ErrorBoundary><AlbumContent /></ErrorBoundary>;
}
