-- ============================================================
-- 0010: clickwrap consent tracking
--   Legal requires provable, active consent (not a passive link).
--   Store WHEN and WHICH VERSION was agreed, so we can force re-consent
--   when terms change.
-- ============================================================

alter table public.profiles
  add column if not exists agreed_at        timestamptz,
  add column if not exists agreed_version   text,
  add column if not exists age_confirmed    boolean not null default false;

-- users update their own consent fields (RLS already covers profiles;
-- ensure authenticated can update these columns)
grant update (agreed_at, agreed_version, age_confirmed) on public.profiles to authenticated;