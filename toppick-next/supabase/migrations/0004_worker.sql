-- 0004: worker support — stable provider id for fixture upserts
alter table matches add column if not exists ext_id text unique;
