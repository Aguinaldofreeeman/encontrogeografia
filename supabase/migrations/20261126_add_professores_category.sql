-- Estende a categoria de fotos para a quarta guia do acervo: Professores (Prancha IV)
alter table public.photos drop constraint if exists photos_category_check;
alter table public.photos
  add constraint photos_category_check
  check (category in ('historico', 'formatura', 'turma', 'professores'));
