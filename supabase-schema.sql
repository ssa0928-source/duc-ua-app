-- DUC UA TF 가설 관리 시스템 v2 — Supabase 스키마
-- Supabase SQL Editor에서 이 파일의 내용을 실행하세요.
-- 기존 테이블이 있다면 DROP 후 재생성됩니다.

drop table if exists ad_performance cascade;
drop table if exists adset_performance cascade;
drop table if exists assets cascade;
drop table if exists hypotheses cascade;

-- 1. hypotheses 테이블
create table hypotheses (
  id text primary key,
  category text,
  title text not null,
  hypothesis text,
  independent_var text,
  fixed_var text,
  control_asset_desc text,
  runtime text,
  phase text,
  start_date date,
  end_date date,
  ipm_test numeric,
  ipm_control numeric,
  ipm_diff numeric,
  reliability text default '⬜ 미검토',
  verdict text default '⬜ 미집행',
  win_reason text,
  next_seed text,
  ai_summary text,
  next_action text,
  status text default '미집행',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. ad_performance 테이블 (개별 Ad 성과)
create table ad_performance (
  id uuid primary key default gen_random_uuid(),
  adset_name text,
  ad_name text,
  asset_type text,
  media_type text,
  resolution text,
  hypothesis_id text references hypotheses(id) on delete set null,
  ipm numeric,
  impressions numeric,
  clicks numeric,
  installs numeric,
  cost numeric,
  ecpi numeric,
  active_users numeric,
  revenue numeric,
  roas numeric,
  af_login numeric,
  af_tutorial_completion numeric,
  upload_date date,
  created_at timestamptz default now()
);

-- 3. adset_performance 테이블 (Ad Set 집계)
create table adset_performance (
  id uuid primary key default gen_random_uuid(),
  adset_name text,
  hypothesis_id text references hypotheses(id) on delete set null,
  avg_ipm numeric,
  total_impressions numeric,
  total_installs numeric,
  total_cost numeric,
  avg_ecpi numeric,
  ad_count integer,
  upload_date date,
  created_at timestamptz default now()
);

-- 4. RLS 정책 (내부 사용자용 - 전체 허용)
alter table hypotheses enable row level security;
alter table ad_performance enable row level security;
alter table adset_performance enable row level security;

create policy "Allow all on hypotheses" on hypotheses for all using (true) with check (true);
create policy "Allow all on ad_performance" on ad_performance for all using (true) with check (true);
create policy "Allow all on adset_performance" on adset_performance for all using (true) with check (true);

-- 5. 인덱스
create index if not exists idx_ad_perf_hypothesis on ad_performance(hypothesis_id);
create index if not exists idx_ad_perf_adset on ad_performance(adset_name);
create index if not exists idx_adset_perf_hypothesis on adset_performance(hypothesis_id);
create index if not exists idx_hypotheses_status on hypotheses(status);
create index if not exists idx_hypotheses_category on hypotheses(category);
