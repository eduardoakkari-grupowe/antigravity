-- ============================================================
-- Roge Select 2026 — Estrutura do banco
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists public.participantes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Dados pessoais
  nome_completo            text not null,
  nome_documento           text,
  data_nascimento          date,
  cpf                      text,
  rg                       text,
  empresa_rede             text,
  cargo                    text,
  telefone                 text,
  email                    text,
  cidade                   text,
  estado                   text,
  documento_embarque       text,
  numero_documento         text,

  -- Saúde / hospedagem
  restricao_alimentar          text,
  restricao_alimentar_qual     text,
  alergia                      text,
  alergia_qual                 text,
  tratamento_medico            text,
  tratamento_medico_qual       text,
  uso_continuo_medicamentos    text,
  uso_continuo_medicamentos_quais text,
  medicacao_pressao            text,
  medicacao_colesterol         text,
  cirurgia_12_meses            text,
  cirurgia_12_meses_qual       text,
  condicao_medica              text,
  condicao_medica_qual         text,

  -- Kit
  tamanho_camiseta         text,
  tamanho_calcado          text,

  -- Foto
  foto_url                 text,

  -- Contato de emergência
  emergencia_nome          text,
  emergencia_parentesco    text,
  emergencia_telefone      text,

  -- Termo
  aceite_termo             boolean default false
);

-- Coluna adicionada após a criação inicial (idempotente).
alter table public.participantes add column if not exists sexo text;

alter table public.participantes enable row level security;

-- Permite que o formulário público (anon) insira cadastros.
drop policy if exists "anon insere cadastros" on public.participantes;
create policy "anon insere cadastros"
  on public.participantes for insert
  to anon
  with check (true);

-- Permite leitura (o /admin usa a chave anon; a proteção é a senha do painel).
drop policy if exists "anon le cadastros" on public.participantes;
create policy "anon le cadastros"
  on public.participantes for select
  to anon
  using (true);

-- ============================================================
-- Storage: bucket público de fotos
-- ============================================================
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do update set public = true;

drop policy if exists "fotos upload anon" on storage.objects;
create policy "fotos upload anon"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'fotos');

drop policy if exists "fotos leitura publica" on storage.objects;
create policy "fotos leitura publica"
  on storage.objects for select
  to anon
  using (bucket_id = 'fotos');
