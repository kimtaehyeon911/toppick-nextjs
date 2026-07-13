-- 0005: add basketball as a 4th sport (sport-scoped stars/passes/leaderboards
-- extend automatically since everything keys on sport_t).
-- NOTE: run this statement on its own (ALTER TYPE ... ADD VALUE cannot run
-- inside a transaction block in some clients).
alter type sport_t add value if not exists 'basketball';
