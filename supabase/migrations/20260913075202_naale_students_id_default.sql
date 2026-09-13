-- Fixes a real bug found during Phase 3 live verification: naale_students.id was created as
-- `uuid primary key` with no default generator. That was fine for Phase 1's own backfill
-- (which always supplies id explicitly, copied from the account's existing students.id), but
-- getNaaleSession()'s first-login insert() never sets id at all and relies on a DB default that
-- didn't exist — so every brand-new Naale sign-up was failing with a NOT NULL violation on id
-- (23502), confirmed live. This was masked in earlier testing because every existing test/real
-- account already had a naale_students row from the Phase 1 backfill; only a genuinely new
-- sign-up ever hits the insert() path this bug breaks.
alter table naale_students alter column id set default gen_random_uuid();
