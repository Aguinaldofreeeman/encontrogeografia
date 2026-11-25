import { onAuthStateChanged, User } from 'firebase/auth';
import { Compass, FileDown, MapPin, Moon, Search, ShieldCheck, Sun, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminDrawer } from './components/AdminDrawer';
import { CommentsSection } from './components/CommentsSection';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PhotoCard } from './components/PhotoCard';
import { PhotoLightbox } from './components/PhotoLightbox';
import { ShareBar } from './components/ShareBar';
import { CATEGORY_META, DEFAULT_SEED_PHOTOS, DEFAULT_SETTINGS } from './data/seedData';
import { useTheme } from './hooks/useTheme';
import { auth, BOOTSTRAPPED_ADMIN_EMAIL, testConnection } from './lib/firebase';
import { exportAlbumToPdf } from './lib/pdfExport';
import {
  checkIsAdminUser,
  subscribeAlbumSettings,
  subscribeComments,
  subscribePhotos,
} from './services/blogService';
import { AlbumSettings, CommentItem, PhotoCategory, PhotoItem } from './types';

const CATEGORY_ORDER: PhotoCategory[] = ['historico', 'formatura', 'turma'];

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

  const [activeCategory, setActiveCategory] = useState<PhotoCategory>('historico');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [heroImgError, setHeroImgError] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
  };

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Startup Firestore connectivity verification
  useEffect(() => {
    void testConnection();
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setIsAdmin(false);
        setIsBootstrappedAdmin(false);
        return;
      }
      const bootstrapped =
        Boolean(currentUser.emailVerified) &&
        currentUser.email === BOOTSTRAPPED_ADMIN_EMAIL;
      setIsBootstrappedAdmin(bootstrapped);
      try {
        const allowed = await checkIsAdminUser(
          currentUser.uid,
          currentUser.email,
          currentUser.emailVerified
        );
        setIsAdmin(allowed);
      } catch {
        setIsAdmin(bootstrapped);
      }
    });
    return () => unsub();
  }, []);

  // Live Firestore subscriptions
  useEffect(() => {
    setPhotosLoading(true);
    const unsubPhotos = subscribePhotos(
      isBootstrappedAdmin,
      (items, hasDocs) => {
        setRemotePhotos(items);
        setHasRemotePhotos(hasDocs);
        setPhotosLoading(false);
      },
      () => {
        setPhotosLoading(false);
      }
    );

    const unsubComments = subscribeComments(
      isBootstrappedAdmin,
      (items) => setComments(items),
      () => {}
    );

    const unsubSettings = subscribeAlbumSettings(
      (data) => setSettings(data),
      () => {}
    );

    return () => {
      unsubPhotos();
      unsubComments();
      unsubSettings();
    };
  }, [isBootstrappedAdmin]);

  // Combine Firestore photos with curated seed preview if Firestore is empty
  const activePhotos: PhotoItem[] = useMemo(() => {
    if (hasRemotePhotos) {
      return remotePhotos;
    }
    return DEFAULT_SEED_PHOTOS.map((item, idx) => ({
      ...item,
      createdAtMs: Date.now() - idx * 1000,
      isSeedPreview: true,
    }));
  }, [hasRemotePhotos, remotePhotos]);

  const publicPhotos = useMemo(
    () => activePhotos.filter((p) => p.visibility === 'public'),
    [activePhotos]
  );

  // Sync URL deep-link (?guia=...&foto=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const guiaParam = params.get('guia') as PhotoCategory | null;
    const fotoParam = params.get('foto');

    if (guiaParam && CATEGORY_ORDER.includes(guiaParam)) {
      setActiveCategory(guiaParam);
    }
    if (fotoParam && publicPhotos.length > 0) {
      const match = publicPhotos.find((p) => p.id === fotoParam);
      if (match) {
        setActiveCategory(match.category);
        setSelectedPhoto(match);
      }
    }
  }, [publicPhotos]);

  const featuredPhoto = useMemo(() => {
    return (
      publicPhotos.find((p) => p.featured) ||
      publicPhotos[0] || {
        ...DEFAULT_SEED_PHOTOS[0],
        createdAtMs: Date.now(),
        isSeedPreview: true,
      }
    );
  }, [publicPhotos]);

  const categoryPhotos = useMemo(() => {
    return publicPhotos.filter((p) => p.category === activeCategory);
  }, [publicPhotos, activeCategory]);

  const availableYears = useMemo(() => {
    const unique = Array.from(new Set(categoryPhotos.map((p) => p.yearLabel)));
    return unique;
  }, [categoryPhotos]);

  const filteredPhotos = useMemo(() => {
    const normalizedQuery = searchQuery
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    return categoryPhotos.filter((p) => {
      if (yearFilter !== 'all' && p.yearLabel !== yearFilter) {
        return false;
      }
      if (!normalizedQuery) return true;

      const normalizedTitle = p.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const normalizedLocation = p.location
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      return (
        normalizedTitle.includes(normalizedQuery) ||
        normalizedLocation.includes(normalizedQuery)
      );
    });
  }, [categoryPhotos, yearFilter, searchQuery]);

  const approvedComments = useMemo(
    () => comments.filter((c) => c.status === 'approved'),
    [comments]
  );

  const albumWallComments = useMemo(
    () => approvedComments.filter((c) => c.targetType === 'album'),
    [approvedComments]
  );

  const pendingCount = useMemo(
    () => comments.filter((c) => c.status === 'pending').length,
    [comments]
  );

  const handleSelectCategory = (cat: PhotoCategory, scrollToGallery = false) => {
    setActiveCategory(cat);
    setYearFilter('all');
    if (scrollToGallery) {
      const el = document.getElementById('acervo');
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleExportPdf = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      const count = await exportAlbumToPdf(publicPhotos, settings);
      showToast(`Álbum editorial em PDF gerado (${count} fotografias públicas).`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível gerar o PDF do álbum.';
      showToast(message);
    } finally {
      setExportingPdf(false);
    }
  };

  const activeCategoryMeta = CATEGORY_META[activeCategory];
  const activeGuide = settings.guides?.[activeCategory] || activeCategoryMeta;

  return (
    <div id="topo" className="min-h-screen flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)] transition-colors duration-200">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-[var(--bg-header)] backdrop-blur-xs border-b border-[var(--border-hairline)]">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Single text brand wordmark */}
          <a
            href="#topo"
            className="font-serif text-xl sm:text-2xl font-semibold tracking-tight text-[var(--text-primary)] whitespace-nowrap shrink-0 truncate max-w-[155px] sm:max-w-none"
          >
            {settings.brandName}
          </a>

          {/* Zone 2: 4 single-line nav links */}
          <nav
            aria-label="Navegação das guias"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-[var(--text-muted)]"
          >
            <button
              type="button"
              onClick={() => handleSelectCategory('historico', true)}
              className={`hover:text-[var(--accent-forest-ink)] transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeCategory === 'historico'
                  ? 'text-[var(--accent-forest-ink)] underline underline-offset-8'
                  : ''
              }`}
            >
              {settings.guides?.historico?.shortLabel || CATEGORY_META.historico.shortLabel}
            </button>
            <button
              type="button"
              onClick={() => handleSelectCategory('formatura', true)}
              className={`hover:text-[var(--accent-forest-ink)] transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeCategory === 'formatura'
                  ? 'text-[var(--accent-forest-ink)] underline underline-offset-8'
                  : ''
              }`}
            >
              {settings.guides?.formatura?.shortLabel || CATEGORY_META.formatura.shortLabel}
            </button>
            <button
              type="button"
              onClick={() => handleSelectCategory('turma', true)}
              className={`hover:text-[var(--accent-forest-ink)] transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeCategory === 'turma'
                  ? 'text-[var(--accent-forest-ink)] underline underline-offset-8'
                  : ''
              }`}
            >
              {settings.guides?.turma?.shortLabel || CATEGORY_META.turma.shortLabel}
            </button>
            <a
              href="#mural-comentarios"
              className="hover:text-[var(--accent-forest-ink)] transition-colors whitespace-nowrap shrink-0"
            >
              {settings.navCommentsLabel}
            </a>
          </nav>

          {/* Zone 3: Primary actions + theme selector */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-pressed={isDark}
              aria-label={isDark ? 'Alternar para modo claro' : 'Alternar para modo noturno de leitura'}
              title={isDark ? 'Modo claro' : 'Modo noturno de leitura'}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] hover:border-[var(--accent-forest-ink)] hover:text-[var(--accent-forest-ink)] text-[11px] sm:text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {isDark ? (
                <Sun className="w-3.5 h-3.5 text-[var(--accent-terracotta)]" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-[var(--accent-ocean-ink)]" />
              )}
              <span className="hidden lg:inline">{isDark ? 'Claro' : 'Noturno'}</span>
            </button>

            <button
              type="button"
              disabled={exportingPdf || photosLoading || publicPhotos.length === 0}
              onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] hover:border-[var(--accent-forest-ink)] hover:text-[var(--accent-forest-ink)] disabled:opacity-55 text-[11px] sm:text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap shrink-0"
            >
              <FileDown className="w-3.5 h-3.5 text-[var(--accent-terracotta)]" />
              <span className="hidden sm:inline">
                {exportingPdf ? 'Gerando PDF...' : 'Exportar Álbum em PDF'}
              </span>
              <span className="sm:hidden">{exportingPdf ? 'PDF...' : 'PDF'}</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-4 py-2 bg-[var(--accent-forest)] text-[var(--accent-forest-contrast)] text-[11px] sm:text-xs font-medium hover:bg-[var(--accent-forest-hover)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {isAdmin
                ? `Painel Admin${pendingCount > 0 ? ` (${pendingCount})` : ''}`
                : 'Área Admin'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Editorial Hero Split */}
        <section className="topographic-grid-bg border-b border-[var(--border-hairline)]">
          <div className="max-w-[1200px] mx-auto px-6 py-8 lg:py-11">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-stretch">
              <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <p className="font-mono text-xs uppercase tracking-widest text-[var(--accent-terracotta)]">
                    {settings.courseTitle} · {settings.degreeLabel} · {settings.classYear}
                  </p>

                  <h1 className="font-serif text-3xl sm:text-4xl lg:text-[3.25rem] font-semibold text-[var(--text-primary)] leading-[1.06] tracking-tight">
                    {settings.heroTitle}
                  </h1>

                  <p className="text-sm sm:text-base text-[var(--text-muted)] leading-relaxed max-w-xl">
                    {settings.introText}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <a
                    href="#mural-comentarios"
                    className="inline-flex items-center px-5 py-2.5 bg-[var(--accent-forest)] text-[var(--accent-forest-contrast)] text-sm font-medium hover:bg-[var(--accent-forest-hover)] transition-colors whitespace-nowrap"
                  >
                    {settings.heroSecondaryCta}
                  </a>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div
                  onClick={() => setSelectedPhoto(featuredPhoto)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedPhoto(featuredPhoto);
                    }
                  }}
                  className="relative h-full min-h-[240px] lg:min-h-[340px] border border-[var(--border-hairline)] bg-[var(--bg-surface-muted)] overflow-hidden cursor-pointer group"
                >
                  {heroImgError ? (
                    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center text-[var(--text-muted)]">
                      <Compass className="w-8 h-8 mb-3 opacity-60" />
                      <p className="font-serif text-xl text-[var(--text-primary)]">{featuredPhoto.title}</p>
                    </div>
                  ) : (
                    <img
                      src={featuredPhoto.imageUrl}
                      alt={featuredPhoto.title}
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgError(true)}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    />
                  )}
                  {featuredPhoto.photographer.trim() && !heroImgError && (
                    <span className="pointer-events-none select-none absolute top-3 right-3 font-mono text-[11px] tracking-wide text-[#F9F7F1]/60 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">
                      © {featuredPhoto.photographer.trim()}
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent p-6 text-[#F9F7F1]">
                    <p className="font-mono text-[11px] uppercase tracking-widest text-[#E5DFD3] mb-1">
                      {featuredPhoto.location}
                    </p>
                    <p className="font-serif text-xl sm:text-2xl font-medium leading-snug">
                      {featuredPhoto.title}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Full-width 4-column summary strip below hero split */}
            <div className="mt-8 pt-6 border-t border-[var(--border-hairline)] grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <p className="font-mono text-2xl font-medium text-[var(--text-primary)] tabular-nums">
                  {String(publicPhotos.length).padStart(2, '0')}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">{settings.statPhotosLabel}</p>
              </div>
              <div>
                <p className="font-mono text-2xl font-medium text-[var(--text-primary)] tabular-nums">
                  03
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">{settings.statGuidesLabel}</p>
              </div>
              <div>
                <p className="font-mono text-2xl font-medium text-[var(--text-primary)] tabular-nums">
                  {String(approvedComments.length).padStart(2, '0')}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">{settings.statCommentsLabel}</p>
              </div>
              <div>
                <p className="font-mono text-sm font-medium text-[var(--accent-forest-ink)] flex items-center gap-1.5 pt-1">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span className="truncate">{settings.institution}</span>
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1.5">{settings.statInstitutionLabel}</p>
              </div>
            </div>
          </div>
        </section>

        {/* 3-Guide Curatorial Archive with Sticky Left Sidebar */}
        <section id="acervo" className="max-w-[1200px] mx-auto px-6 py-10 lg:py-12">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 sm:gap-8 lg:gap-10 items-start">
            {/* Left Sidebar: Vertical Guide Index (sm/md/lg) + Compact Tabs (<640px mobile) + Search & Period Filter */}
            <aside className="sm:col-span-4 lg:col-span-3 sm:sticky sm:top-20 space-y-5">
              {/* Mobile-only horizontal compact guide tabs (< 640px) */}
              <div
                role="tablist"
                aria-label="Guias de fotografias"
                className="flex sm:hidden flex-wrap items-center gap-1 p-1 bg-[var(--bg-surface-muted)] border border-[var(--border-hairline)]"
              >
                {CATEGORY_ORDER.map((cat) => {
                  const meta = settings.guides?.[cat] || CATEGORY_META[cat];
                  const count = publicPhotos.filter((p) => p.category === cat).length;
                  const active = activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => handleSelectCategory(cat)}
                      className={`flex-1 px-3 py-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-[var(--accent-forest)] text-[var(--accent-forest-contrast)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {meta.shortLabel} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Left-side vertical index navigation (640px+) */}
              <div className="hidden sm:block space-y-2">
                <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--text-muted)]">
                  Índice das Guias
                </p>
                <div
                  role="tablist"
                  aria-orientation="vertical"
                  aria-label="Guias de fotografias"
                  className="flex flex-col border border-[var(--border-hairline)] bg-[var(--bg-surface)] divide-y divide-[var(--border-soft)]"
                >
                  {CATEGORY_ORDER.map((cat) => {
                    const meta = settings.guides?.[cat] || CATEGORY_META[cat];
                    const count = publicPhotos.filter((p) => p.category === cat).length;
                    const active = activeCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => handleSelectCategory(cat)}
                        className={`w-full text-left px-4 py-3.5 transition-colors cursor-pointer space-y-1 ${
                          active
                            ? 'bg-[var(--accent-forest)] text-[var(--accent-forest-contrast)]'
                            : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`font-mono text-[11px] uppercase tracking-wider ${
                              active
                                ? 'text-[var(--accent-forest-contrast)] opacity-85'
                                : 'text-[var(--accent-terracotta)]'
                            }`}
                          >
                            {meta.romanIndex || CATEGORY_META[cat].romanIndex}
                          </span>
                          <span
                            className={`font-mono text-[11px] tabular-nums ${
                              active
                                ? 'text-[var(--accent-forest-contrast)] opacity-85'
                                : 'text-[var(--text-muted)]'
                            }`}
                          >
                            {String(count).padStart(2, '0')}
                          </span>
                        </div>
                        <p className="font-serif text-base font-semibold leading-snug">
                          {meta.shortLabel}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick search inside sidebar */}
              <div className="space-y-2">
                <label
                  htmlFor="archive-quick-search"
                  className="block font-mono text-[11px] uppercase tracking-widest text-[var(--text-muted)]"
                >
                  Busca rápida
                </label>
                <div className="relative">
                  <Search
                    aria-hidden="true"
                    className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  />
                  <input
                    id="archive-quick-search"
                    type="text"
                    aria-label="Buscar fotos por título ou localização"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={settings.searchPlaceholder}
                    className="w-full pl-9 pr-9 py-2.5 text-sm bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--accent-forest-ink)] transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      aria-label="Limpar busca"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Secondary period filter inside sidebar */}
              {availableYears.length > 1 && (
                <div className="space-y-2">
                  <span className="block font-mono text-[11px] uppercase tracking-widest text-[var(--text-muted)]">
                    Período
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setYearFilter('all')}
                      className={`px-2.5 py-1.5 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                        yearFilter === 'all'
                          ? 'bg-[var(--btn-active-bg)] text-[var(--btn-active-text)] border-[var(--btn-active-bg)]'
                          : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-hairline)] hover:border-[var(--accent-forest-ink)]'
                      }`}
                    >
                      Todos
                    </button>
                    {availableYears.map((yr) => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => setYearFilter(yr)}
                        className={`px-2.5 py-1.5 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                          yearFilter === yr
                            ? 'bg-[var(--btn-active-bg)] text-[var(--btn-active-text)] border-[var(--btn-active-bg)]'
                            : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-hairline)] hover:border-[var(--accent-forest-ink)]'
                        }`}
                      >
                        {yr}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </aside>

            {/* Right Column: Active Guide Header & Photo Grid */}
            <div className="sm:col-span-8 lg:col-span-9 space-y-6 min-w-0">
              <div className="border-b border-[var(--border-hairline)] pb-6 space-y-2">
                <p className="font-mono text-xs uppercase tracking-widest text-[var(--accent-terracotta)]">
                  {activeGuide.romanIndex || activeCategoryMeta.romanIndex} · {activeGuide.subtitle}
                </p>
                <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-[var(--text-primary)]">
                  {activeGuide.label}
                </h2>
                <p className="text-sm sm:text-base text-[var(--text-muted)] leading-relaxed max-w-2xl">
                  {activeGuide.description}
                </p>
              </div>

              {(searchQuery.trim() !== '' || yearFilter !== 'all') && (
                <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
                  <span className="font-mono tabular-nums">
                    {filteredPhotos.length}{' '}
                    {filteredPhotos.length === 1 ? 'registro encontrado' : 'registros encontrados'}
                    {searchQuery.trim() !== '' ? ` para “${searchQuery.trim()}”` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setYearFilter('all');
                    }}
                    className="text-[var(--accent-forest-ink)] font-medium hover:underline cursor-pointer whitespace-nowrap"
                  >
                    Limpar filtros
                  </button>
                </div>
              )}

              {/* Photo Grid */}
              {photosLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[1, 2, 3, 4].map((item) => (
                    <div
                      key={item}
                      className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] h-80 animate-pulse"
                    />
                  ))}
                </div>
              ) : filteredPhotos.length === 0 ? (
                searchQuery.trim() !== '' || yearFilter !== 'all' ? (
                  <div className="bg-[var(--bg-surface)] border border-dashed border-[var(--border-hairline)] p-12 text-center space-y-4">
                    <Search className="w-7 h-7 text-[var(--text-muted)] mx-auto" />
                    <h3 className="font-serif text-2xl font-semibold text-[var(--text-primary)]">
                      Nenhuma fotografia encontrada com esses critérios
                    </h3>
                    <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
                      Não encontramos registros em {activeGuide.label.toLowerCase()} correspondentes à busca atual. Tente outro termo de título ou localização.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setYearFilter('all');
                      }}
                      className="px-4 py-2 bg-[var(--accent-forest)] text-[var(--accent-forest-contrast)] text-xs font-medium hover:bg-[var(--accent-forest-hover)] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Mostrar todas as fotos da guia
                    </button>
                  </div>
                ) : (
                  <div className="bg-[var(--bg-surface)] border border-dashed border-[var(--border-hairline)] p-12 text-center space-y-3">
                    <Compass className="w-7 h-7 text-[var(--text-muted)] mx-auto" />
                    <h3 className="font-serif text-2xl font-semibold text-[var(--text-primary)]">
                      Nenhuma fotografia publicada nesta guia ainda
                    </h3>
                    <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
                      O administrador pode adicionar novos registros de {activeGuide.label.toLowerCase()} pelo botão Área Admin no topo da página.
                    </p>
                  </div>
                )
              ) : (
                <div className="space-y-6">
                  {/* First item rendered as editorial lead story */}
                  <PhotoCard
                    photo={filteredPhotos[0]}
                    featuredLayout
                    commentCount={
                      approvedComments.filter(
                        (c) => c.targetType === 'photo' && c.photoId === filteredPhotos[0].id
                      ).length
                    }
                    onOpen={setSelectedPhoto}
                  />

                  {filteredPhotos.length > 1 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {filteredPhotos.slice(1).map((item) => (
                        <PhotoCard
                          key={item.id}
                          photo={item}
                          commentCount={
                            approvedComments.filter(
                              (c) => c.targetType === 'photo' && c.photoId === item.id
                            ).length
                          }
                          onOpen={setSelectedPhoto}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* General Album Comments & Social Sharing */}
        <section
          id="mural-comentarios"
          className="bg-[var(--bg-surface-muted)] border-t border-[var(--border-hairline)] py-14"
        >
          <div className="max-w-[1200px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-5 space-y-6">
              <div className="space-y-3">
                <p className="font-mono text-xs uppercase tracking-widest text-[var(--accent-terracotta)]">
                  {settings.commentsKicker}
                </p>
                <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-[var(--text-primary)]">
                  {settings.commentsTitle}
                </h2>
                <p className="text-sm sm:text-base text-[var(--text-muted)] leading-relaxed">
                  {settings.commentsIntro}
                </p>
              </div>

              <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-6 space-y-4">
                <h3 className="font-serif text-lg font-semibold text-[var(--text-primary)]">
                  {settings.shareTitle}
                </h3>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  {settings.shareDescription}
                </p>
                <ShareBar
                  title={`${settings.brandName} — ${settings.courseTitle} (${settings.classYear})`}
                  description={`${settings.degreeLabel} · Memórias históricas, formatura e fotos da turma`}
                  category={activeCategory}
                  onNotify={showToast}
                />
              </div>
            </div>

            <div className="lg:col-span-7">
              <CommentsSection
                comments={albumWallComments}
                photoId="album"
                targetType="album"
                formTitle={settings.commentFormTitle}
                formNotice={settings.commentFormNotice}
                onNotify={showToast}
              />
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Editorial Colophon Footer */}
      <footer className="bg-[var(--bg-canvas)] border-t border-[var(--border-hairline)]">
        <div className="max-w-[1200px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
          <div className="space-y-1">
            <p className="font-serif text-base font-semibold text-[var(--text-primary)]">
              {settings.courseTitle} — {settings.degreeLabel}
            </p>
            <p>
              {settings.institution} · {settings.classYear}
            </p>
            {settings.footerNote.trim() !== '' && (
              <p className="text-[var(--text-subtle)]">{settings.footerNote}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <a href="#acervo" className="hover:text-[var(--accent-forest-ink)] transition-colors">
              Acervo
            </a>
            <a href="#mural-comentarios" className="hover:text-[var(--accent-forest-ink)] transition-colors">
              {settings.navCommentsLabel}
            </a>
            <button
              type="button"
              onClick={toggleTheme}
              className="hover:text-[var(--accent-forest-ink)] transition-colors cursor-pointer"
            >
              {isDark ? 'Modo Claro' : 'Modo Noturno'}
            </button>
            <button
              type="button"
              onClick={() => setAdminOpen(true)}
              className="hover:text-[var(--accent-forest-ink)] transition-colors cursor-pointer"
            >
              Área Admin
            </button>
          </div>
        </div>
      </footer>

      {/* Photo Lightbox */}
      <PhotoLightbox
        photo={selectedPhoto}
        photosInScope={categoryPhotos}
        comments={approvedComments}
        settings={settings}
        onClose={() => setSelectedPhoto(null)}
        onSelectPhoto={(next) => setSelectedPhoto(next)}
        onNotify={showToast}
      />

      {/* Admin Drawer */}
      <AdminDrawer
        isOpen={adminOpen}
        onClose={() => setAdminOpen(false)}
        user={user}
        isAdmin={isAdmin}
        isBootstrappedAdmin={isBootstrappedAdmin}
        photos={activePhotos}
        hasRemotePhotos={hasRemotePhotos}
        comments={comments}
        settings={settings}
        onNotify={showToast}
      />

      {/* Toast feedback */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 bg-[var(--bg-toast)] text-[var(--text-toast)] px-4 py-3 text-xs font-medium border border-[var(--border-hairline)] shadow-lg max-w-sm"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AlbumContent />
    </ErrorBoundary>
  );
}
