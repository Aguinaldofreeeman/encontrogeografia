# Guia "Professores" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar a quarta guia de fotos "Professores" (Prancha IV) à barra lateral, logo abaixo de "Turma", com upload, persistência, PDF e migração SQL equivalentes às guias existentes.

**Architecture:** Estender o tipo discriminado `PhotoCategory` com `'professores'` e propagar às listas fixas de categorias (navegação, admin, validação, persistência, PDF). A galeria, filtros, comentários e lightbox reusam a estrutura existente sem código novo. Uma migração SQL relaxa o `CHECK` de categoria do banco.

**Tech Stack:** React 19, TypeScript (strict via `tsc --noEmit`), Vite, Tailwind 4, Supabase (tabelas `photos`, `settings`), jsPDF, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-26-guia-professores-design.md`

## Global Constraints

- Verificação = `npm run lint` (`tsc --noEmit`) + `npm run build`. Não há framework de testes no projeto; não introduzir um.
- Rótulos exatos da nova guia: `label: 'Fotos dos Professores'`, `shortLabel: 'Professores'`, `romanIndex: 'Prancha IV'`.
- Subtítulo: `Docência, Orientação e Legado Acadêmico`.
- Descrição: `Retratos e registros dos docentes que conduziram aulas de campo, seminários e pesquisas, preservando o vínculo entre quem ensinou e a turma que se formou.`
- Ícone da guia: `BookOpen` de `lucide-react`.
- Ordem na sidebar: `['historico', 'formatura', 'turma', 'professores']` — "Professores" sempre após "Turma".
- Textos de UI em português; maiúsculas/versalete seguem os padrões já existentes no arquivo.
- Nenhum commit deve deixar `npm run lint` vermelho.

## Review Focus

1. **Banco recusa a nova categoria:** sem a migração, o upload de foto "professores" falha com erro do Postgres. → Task 5 cria a migração; revisor deve ler o SQL e confirmar que o `DROP CONSTRAINT IF EXISTS` cobre o nome auto-gerado `photos_category_check` (constraint inline de coluna).
2. **Settings remoto sem a 4ª guia:** o JSONB salvo no Supabase só tem 3 guias; `settingsForm.guides.professores` pode ser `undefined` e derrubar o form do admin. → Task 3 garante que `normalizeSettings` sempre injeta a guia com fallback; revisor confere `mergeGuideConfig(rawGuides.professores, DEFAULT_SETTINGS.guides.professores)`.
3. **Guia some ao salvar configurações:** `saveAlbumSettings` reconstrói `guides` com lista fixa de chaves; se `professores` faltou, a guia é descartada no payload. → Task 3 inclui a chave no payload e no loop de obrigatoriedade (linhas 458-479 de `blogService.ts`).
4. **Listas fixas esquecidas:** qualquer `Record<PhotoCategory, ...>` ou array literal sem `'professores'` quebra o `tsc` ou silenciosamente omite a guia. → `npm run lint` em cada task cobre os Record (falha barulhenta); para arrays literais (`CATEGORY_ORDER`, `CATEGORY_SEQUENCE`, filtro do admin) revisar o grep final da Task 5.
5. **Sidebar fora de ordem / home desatualizada:** "Professores" tem que aparecer imediatamente abaixo de "Turma" e a estatística "Guias temáticas" tem que virar 04. → Task 1, verificação manual no `npm run dev`.

---

### Task 1: Categoria "professores" no núcleo (tipo, textos, navegação)

**Files:**
- Modify: `src/types.ts:1`
- Modify: `src/data/seedData.ts:3-31` (CATEGORY_META) e `:60-83` (DEFAULT_SETTINGS.guides)
- Modify: `src/App.tsx:1` (ícone), `:26` (CATEGORY_ORDER), `:28-32` (CATEGORY_ICONS), `:62-65` (activeCategory), `:374` (stat "03"), `:383` (render da guia)

**Interfaces:**
- Produces: `PhotoCategory` com `'professores'`; `CATEGORY_META.professores` (`CategoryMeta` completo); `DEFAULT_SETTINGS.guides.professores` (`GuideTextConfig`); `CATEGORY_ORDER` com 4 itens. Tasks 2-5 consomem esses nomes.

- [ ] **Step 1: Estender o tipo**

Em `src/types.ts` linha 1:
```ts
export type PhotoCategory = 'historico' | 'formatura' | 'turma' | 'professores';
```

- [ ] **Step 2: Adicionar textos da guia em `seedData.ts`**

Nova entrada em `CATEGORY_META` (após `turma`), mesmas chaves das demais:
```ts
professores: {
  id: 'professores',
  label: 'Fotos dos Professores',
  shortLabel: 'Professores',
  romanIndex: 'Prancha IV',
  subtitle: 'Docência, Orientação e Legado Acadêmico',
  description:
    'Retratos e registros dos docentes que conduziram aulas de campo, seminários e pesquisas, preservando o vínculo entre quem ensinou e a turma que se formou.',
},
```
E a mesma entrada (copiando os 5 campos de `CATEGORY_META.professores`, como já feito para as outras) em `DEFAULT_SETTINGS.guides`, após `turma`.

- [ ] **Step 3: Atualizar `App.tsx`**

1. Linha 1: adicionar `BookOpen` ao import de `lucide-react` (ordem alfabética do import atual).
2. Linha 26: `const CATEGORY_ORDER: PhotoCategory[] = ['historico', 'formatura', 'turma', 'professores'];`
3. Linha 28-32: adicionar `professores: BookOpen,` ao objeto `CATEGORY_ICONS`.
4. Linhas 62-65, substituindo a enumeração:
```ts
const activeCategory: PhotoCategory = activeView && (CATEGORY_ORDER as readonly string[]).includes(activeView)
  ? (activeView as PhotoCategory)
  : 'historico';
```
5. Linha 374: trocar `03` por `04` (estatística "Guias temáticas" na home).
6. Linha 383: substituindo a enumeração:
```tsx
{(activeView as PhotoCategory) !== 'inicio' && (activeView as PhotoCategory) !== 'comentarios' && CATEGORY_ORDER.includes(activeView as PhotoCategory) && (
```
   (Equivalente e mais limpo: guardar `const isCategoryView = CATEGORY_ORDER.includes(activeView as PhotoCategory)` perto da linha 62 e usar `{isCategoryView && (`.)

- [ ] **Step 4: Verificar tipos**

Run: `npm run lint`
Expected: exit 0, sem erros. Se `CATEGORY_META[activeView]`/`settings.guides[activeView]` (linhas 251-256) acusarem narrowing, manter o comportamento atual — o alvo é compilar sem mudar o título da view.

- [ ] **Step 5: Verificação manual**

Run: `npm run dev`
Expected: na sidebar, "Professores" aparece imediatamente abaixo de "Turma"; clicando, a página mostra "Prancha IV · Docência, Orientação e Legado Acadêmico" com o estado vazio "Nenhuma fotografia publicada nesta guia ainda"; a home mostra `04` em "Guias temáticas". Link `?guia=professores` abre a guia.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/data/seedData.ts src/App.tsx
git commit -m "feat: add Professores guide as fourth photo category"
```

---

### Task 2: Painel admin — publicar e editar a 4ª guia

**Files:**
- Modify: `src/components/AdminDrawer.tsx:835-849` (seletor de categoria), `:1386` (texto "três guias"), `:1632` (título "Três Guias"), `:1635` (array de guias do form de settings)

**Interfaces:**
- Consomes: `CATEGORY_META.professores`, `PhotoCategory` com `'professores'` (Task 1).

- [ ] **Step 1: Opção no seletor de categoria do upload**

Após o `<option value="turma">` (~linha 845), mesmo formato:
```tsx
<option value="professores">
  {settings.guides?.professores?.label || CATEGORY_META.professores.label}
</option>
```

- [ ] **Step 2: Incluir a guia no form de textos**

Linha 1635: `{(['historico', 'formatura', 'turma', 'professores'] as PhotoCategory[]).map((cat) => {`

- [ ] **Step 3: Ajustar os textos "três" → "quatro"**

- Linha 1386: `Personalize marca, capa, nomes e descrições das quatro guias e seção de comentários.`
- Linha 1632: `Textos das Quatro Guias do Acervo`

- [ ] **Step 4: Verificar tipos**

Run: `npm run lint`
Expected: exit 0.

- [ ] **Step 5: Verificação manual**

Run: `npm run dev` → Área Admin → Publicar: o seletor "Guia do blog" lista "Fotos dos Professores". Aba de configurações: quatro blocos "Guia · ..." sem erro de runtime.

- [ ] **Step 6: Commit**

```bash
git add src/components/AdminDrawer.tsx
git commit -m "feat: admin panel supports Professores guide texts and photos"
```

---

### Task 3: Persistência e validação no Supabase

**Files:**
- Modify: `src/services/blogService.ts:237-241` (normalizeSettings), `:458-462` (payload guides), `:474-479` (loop de obrigatoriedade)
- Modify: `src/lib/validation.ts:17`

**Interfaces:**
- Consomes: `DEFAULT_SETTINGS.guides.professores` (Task 1).
- Produces: settings remotos sempre com as 4 chaves de `guides`; `VALIDATION_BOUNDS.photo.categories` incluindo `'professores'`.

- [ ] **Step 1: Normalizar settings remotos**

Em `normalizeSettings`, dentro de `guides: { ... }`, após a linha de `turma`:
```ts
professores: mergeGuideConfig(rawGuides.professores, DEFAULT_SETTINGS.guides.professores),
```
(Isso cobre o JSONB antigo salvo no banco, que só tem 3 guias.)

- [ ] **Step 2: Persistir a guia ao salvar**

No objeto `guides` do `payload` (linha 458):
```ts
professores: sanitizeGuide(settings.guides.professores),
```

- [ ] **Step 3: Validar os 4 textos**

Linha 474: `for (const key of ['historico', 'formatura', 'turma', 'professores'] as const) {`
Mensagem da linha 477: `Preencha todos os índices, títulos, subtítulos e descrições das quatro guias.`

- [ ] **Step 4: Atualizar lista de categorias validadas**

`src/lib/validation.ts:17`:
```ts
categories: ['historico', 'formatura', 'turma', 'professores'] as readonly PhotoCategory[],
```

- [ ] **Step 5: Verificar tipos**

Run: `npm run lint`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/services/blogService.ts src/lib/validation.ts
git commit -m "feat: persist and validate Professores guide settings"
```

---

### Task 4: PDF inclui a Prancha IV

**Files:**
- Modify: `src/lib/pdfExport.ts:5`

- [ ] **Step 1: Estender a sequência**

```ts
const CATEGORY_SEQUENCE: PhotoCategory[] = ['historico', 'formatura', 'turma', 'professores'];
```
Isso atualiza sozinho o sumário da capa (loop da linha 219) e a ordenação das pranchas (linha 97).

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build conclui sem erro de tipos.

- [ ] **Step 3: Commit**

```bash
git add src/lib/pdfExport.ts
git commit -m "feat: include Professores plate in PDF export"
```

---

### Task 5: Migração SQL + verificação final

**Files:**
- Create: `supabase/migrations/20261126_add_professores_category.sql`

- [ ] **Step 1: Criar a migração**

O `CHECK` atual foi criado inline na coluna (`supabase/migrations/20260525_init_atlas_memorias.sql:30`), logo o Postgres o nomeou `photos_category_check`. Conteúdo do arquivo:
```sql
-- Estende a categoria de fotos para a quarta guia do acervo: Professores (Prancha IV)
alter table public.photos drop constraint if exists photos_category_check;
alter table public.photos
  add constraint photos_category_check
  check (category in ('historico', 'formatura', 'turma', 'professores'));
```

- [ ] **Step 2: Varredura final de listas fixas**

Run (PowerShell):
```powershell
Select-String -Path src\**\*.ts, src\**\*.tsx -Pattern "'turma'" | Select-Object Path, LineNumber, Line
```
Expected: toda ocorrência restante de arrays/uniões com `'turma'` já contém `'professores'` (ou é comentário/dado semântico, ex.: `'Colega de Turma'`).

- [ ] **Step 3: Verificação completa**

Run: `npm run lint` e depois `npm run build`
Expected: ambos exit 0.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261126_add_professores_category.sql
git commit -m "feat: migration allowing Professores photo category"
```

**Entrega ao usuário:** informar que a migração precisa ser executada no SQL Editor do Supabase antes/depois do deploy, e que as fotos da guia são publicadas pelo painel admin.
