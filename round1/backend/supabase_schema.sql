-- ResQNet: run ONCE in Supabase -> SQL Editor -> New query -> Run.
create table if not exists public.resq_incidents (
  seq  integer primary key,
  id   text not null unique,
  data jsonb not null
);
create table if not exists public.resq_docs (
  kind text not null,
  id   text not null,
  ord  bigint generated always as identity,
  data jsonb not null,
  primary key (kind, id)
);
create index if not exists resq_docs_kind_ord on public.resq_docs (kind, ord);

-- Backend-only data: RLS on, NO policies -> the public (publishable/anon) key can't read or write.
alter table public.resq_incidents enable row level security;
alter table public.resq_docs enable row level security;

-- The backend uses the SECRET key (service_role), which bypasses RLS. Make sure it can reach the tables
-- even if new tables are not auto-exposed to the Data API in this project.
grant select, insert, update, delete on public.resq_incidents, public.resq_docs to service_role;
revoke all on public.resq_incidents, public.resq_docs from anon, authenticated;
