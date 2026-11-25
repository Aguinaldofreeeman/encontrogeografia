import { AlbumSettings, CategoryMeta, PhotoItem } from '../types';

export const CATEGORY_META: Record<'historico' | 'formatura' | 'turma', CategoryMeta> = {
  historico: {
    id: 'historico',
    label: 'Fotos Históricas do Curso',
    shortLabel: 'Históricas',
    romanIndex: 'Prancha I',
    subtitle: 'Cartografia, Trabalhos de Campo e Ambiente',
    description:
      'Registros das expedições de campo, práticas em laboratório de cartografia, análises de bacias hidrográficas e encontros acadêmicos que moldaram nosso olhar sobre o território.',
  },
  formatura: {
    id: 'formatura',
    label: 'Fotos da Formatura',
    shortLabel: 'Formatura',
    romanIndex: 'Prancha II',
    subtitle: 'Colação de Grau, Outorga e Celebração',
    description:
      'A solenidade da entrega dos diplomas, o juramento profissional e os abraços que marcaram o encerramento de uma jornada construída com rigor científico e compromisso social.',
  },
  turma: {
    id: 'turma',
    label: 'Fotos da Turma',
    shortLabel: 'Turma',
    romanIndex: 'Prancha III',
    subtitle: 'Sociedade, Companheirismo e Retratos Coletivos',
    description:
      'Retratos de grupo no departamento, pausas entre mapas e leituras críticas da cidade e do campo, celebrando as amizades que seguem para além do campus.',
  },
};

export const DEFAULT_SETTINGS: AlbumSettings = {
  brandName: 'Atlas & Memórias',
  navCommentsLabel: 'Comentários',
  courseTitle: 'Geografia',
  degreeLabel: 'Licenciatura Plena e Bacharelado',
  classYear: 'Turma 2024',
  institution: 'Departamento de Geografia · Instituto de Geociências',
  heroTitle: 'Cartografia, Ambiente e Sociedade em Memória',
  introText:
    'Entre curvas de nível, cadernos de campo e debates sobre território, meio ambiente e sociedade, este atlas reúne as memórias visuais da nossa graduação — da primeira carta topográfica à colação de grau.',
  heroSecondaryCta: 'Deixar Homenagem',
  statPhotosLabel: 'Registros no acervo',
  statGuidesLabel: 'Guias temáticas',
  statCommentsLabel: 'Mensagens publicadas',
  statInstitutionLabel: 'Origem acadêmica',
  statViewsLabel: 'Visualizações',
  searchPlaceholder: 'Buscar por título ou localização...',
  commentsKicker: 'Caderno de Campo & Divulgação',
  commentsTitle: 'Mural de Mensagens e Compartilhamento',
  commentsIntro:
    'Envie uma dedicatória para os formandos ou compartilhe este álbum diretamente com colegas, professores e familiares.',
  shareTitle: 'Compartilhar o álbum da turma',
  shareDescription:
    'Você também pode abrir qualquer foto do acervo para gerar um link direto daquela prancha específica nas redes sociais.',
  commentFormTitle: 'Deixe uma mensagem no caderno da turma',
  commentFormNotice: 'Comentários ficam visíveis após aprovação editorial.',
  footerNote: '',
  guides: {
    historico: {
      romanIndex: CATEGORY_META.historico.romanIndex,
      label: CATEGORY_META.historico.label,
      shortLabel: CATEGORY_META.historico.shortLabel,
      subtitle: CATEGORY_META.historico.subtitle,
      description: CATEGORY_META.historico.description,
    },
    formatura: {
      romanIndex: CATEGORY_META.formatura.romanIndex,
      label: CATEGORY_META.formatura.label,
      shortLabel: CATEGORY_META.formatura.shortLabel,
      subtitle: CATEGORY_META.formatura.subtitle,
      description: CATEGORY_META.formatura.description,
    },
    turma: {
      romanIndex: CATEGORY_META.turma.romanIndex,
      label: CATEGORY_META.turma.label,
      shortLabel: CATEGORY_META.turma.shortLabel,
      subtitle: CATEGORY_META.turma.subtitle,
      description: CATEGORY_META.turma.description,
    },
  },
};

export const DEFAULT_SEED_PHOTOS: Omit<PhotoItem, 'createdAtMs' | 'isSeedPreview'>[] = [
  {
    id: 'seed-turma-mirante',
    category: 'turma',
    title: 'Leitura da Paisagem no Mirante da Serra',
    caption:
      'Durante o trabalho de campo integrador de encerramento do curso, a turma analisou o uso e ocupação do solo no vale com cartas topográficas em escala regional e bússola de geólogo.',
    imageUrl: '/src/assets/images/hero_turma_campo_1795551791490.jpg',
    yearLabel: '2024 · Campo Final',
    location: 'Serra do Espinhaço, MG',
    photographer: 'Acervo da Comissão',
    featured: true,
    visibility: 'public',
    authorUid: 'seed',
  },
  {
    id: 'seed-historico-cartografia',
    category: 'historico',
    title: 'Oficina de Cartografia Temática e Fotointerpretação',
    caption:
      'Tardes no laboratório de cartografia analisando pares estereoscópicos, traçando curvas de nível à mão e organizando cadernos de observação geomorfológica.',
    imageUrl: '/src/assets/images/historico_cartografia_1795551792313.jpg',
    yearLabel: '2022 · 4º Semestre',
    location: 'Laboratório de Cartografia',
    photographer: 'Coordenação de Campo',
    featured: false,
    visibility: 'public',
    authorUid: 'seed',
  },
  {
    id: 'seed-historico-bacia',
    category: 'historico',
    title: 'Levantamento Hidrossedimentológico e Perfil de Solo',
    caption:
      'Excursão didática de Hidrogeografia e Pedologia para descrição de horizontes do solo, medição de vazão fluvial e diagnóstico ambiental da microbacia.',
    imageUrl: '/src/assets/images/historico_campo_rio_1795551792452.jpg',
    yearLabel: '2023 · 6º Semestre',
    location: 'Bacia do Alto Rio das Velhas',
    photographer: 'Prof. Orientação de Campo',
    featured: false,
    visibility: 'public',
    authorUid: 'seed',
  },
  {
    id: 'seed-formatura-colacao',
    category: 'formatura',
    title: 'Aplausos após a Outorga de Grau',
    caption:
      'Momento em que os novos licenciados e bacharéis em Geografia celebram com os diplomas em mãos diante de familiares, professores e amigos no auditório histórico.',
    imageUrl: '/src/assets/images/formatura_colacao_1795551793114.jpg',
    yearLabel: '2024 · Colação',
    location: 'Salão Nobre Universitário',
    photographer: 'Estúdio Memória Acadêmica',
    featured: false,
    visibility: 'public',
    authorUid: 'seed',
  },
  {
    id: 'seed-formatura-diploma',
    category: 'formatura',
    title: 'Canudo, Globo e Bússola na Mesa Solene',
    caption:
      'Registro simbólico da entrega de grau reunindo o diploma em fita verde-floresta, o globo terrestre clássico e a bússola que nos acompanhou pelos trajetos de campo.',
    imageUrl: '/src/assets/images/formatura_diploma_1795551793045.jpg',
    yearLabel: '2024 · Cerimônia',
    location: 'Reitoria · Salão de Atos',
    photographer: 'Estúdio Memória Acadêmica',
    featured: false,
    visibility: 'public',
    authorUid: 'seed',
  },
  {
    id: 'seed-turma-escadaria',
    category: 'turma',
    title: 'Retrato Oficial na Escadaria do Departamento',
    caption:
      'Reunião da turma nas escadarias de pedra do Departamento de Geografia após a defesa dos últimos Trabalhos de Conclusão de Curso, celebrando anos de pesquisa e convivência.',
    imageUrl: '/src/assets/images/turma_retrato_campus_1795551793861.jpg',
    yearLabel: '2024 · Formandos',
    location: 'Pátio Central de Geografia',
    photographer: 'Acervo da Turma',
    featured: false,
    visibility: 'public',
    authorUid: 'seed',
  },
];
