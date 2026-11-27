# Design: guia "Professores" (Prancha IV)

**Data:** 2026-11-26 · **Status:** aprovado pelo parceiro humano

## Intenção

O álbum "Atlas & Memórias" tem três guias de fotos (Históricas, Formatura, Turma) na barra lateral. Adicionar uma quarta guia, **"Professores"**, posicionada logo abaixo de "Turma", funcionando exatamente como as guias existentes: galeria com busca, filtros por ano, comentários, lightbox, upload pelo painel admin e seção própria no PDF exportado.

## Goals

- Nova categoria `'professores'` em `PhotoCategory`, com textos editoriais próprios em `CATEGORY_META` (rótulo "Fotos dos Professores", curto "Professores", "Prancha IV").
- Guia visível na barra lateral imediatamente após "Turma" e renderizando a mesma galeria das outras guias.
- Painel admin capaz de publicar e gerenciar fotos dessa categoria, além de editar os textos da quarta guia.
- Persistência: `normalizeSettings`/`saveAlbumSettings` do Supabase cobrem a nova guia; validação aceita a categoria.
- PDF inclui a seção Prancha IV.
- Migração SQL relaxando o `CHECK` de categoria existente no banco.

## Non-goals / Anti-goals

- Não criar tela nova nem formato de conteúdo diferente (lista textual, fichas de docentes).
- Não alterar comentários, autenticação, comparthamento ou visual das guias existentes.
- Não adicionar fotos de seed: a guia abre com o estado vazio existente.
- Não reestruturar arquivos grandes existentes.

## Constraints

- Projeto React 19 + Vite + TypeScript, sem framework de testes; verificação = `npm run lint` (`tsc --noEmit`), `npm run build` e checagem manual no `npm run dev`.
- Textos seguem o tom editorial português das guias existentes (verbo no gerúndio, vocabulário acadêmico).
- O banco Supabase tem `check (category in ('historico','formatura','turma'))` na tabela `photos`; a migração precisa ser aplicada pelo usuário no SQL Editor.

## Approaches

1. **Estender a categoria existente (escolhida):** adicionar `'professores'` ao tipo e às listas fixas de categorias. Reusa 100% da infraestrutura de galeria.
2. **Tela nova construída à mão:** duplicaria galeria/filtros/cards, manutenção dupla. Rejeitada — o usuário escolheu fotos no padrão das guias.

## Decisões

- Ícone na barra lateral: `BookOpen` (lucide-react), evitando repetir `GraduationCap`/`Users`.
- Listas fixas do App.tsx passam a usar `CATEGORY_ORDER.includes(...)` para que a próxima guia não exija editar três lugares.
- Estatística da home "03 Guias temáticas" vira "04".
- Títulos do admin que dizem "Três Guias" passam a "Quatro Guias".

## O que ficou para o executor

- Aplicar a migração `supabase/migrations/20261126_add_professores_category.sql` no banco remoto (usuário).
- Publicar as fotos de professores pelo painel admin (usuário).
