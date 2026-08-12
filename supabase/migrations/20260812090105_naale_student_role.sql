-- Staff (counselors/teachers) get students rows too, because they can run
-- practice sessions themselves — so the staff-facing student list needs a way
-- to exclude them, or counselors would see each other listed as students.
--
-- The role already exists in naale_roster, but that's keyed by email while
-- students rows are keyed by auth_user_id and carry no email. Denormalizing the
-- role onto students at provisioning time avoids a Supabase Admin API lookup on
-- every staff page load.
--
-- Nullable and additive: existing rows on the other two tracks stay null.

alter table students add column if not exists naale_role text;
alter table students add constraint students_naale_role_check
  check (naale_role is null or naale_role in ('student', 'staff'));

-- Backfill: any Naale accounts provisioned between ticket 3 and this migration
-- have naale_role = null. Derive it from naale_roster via auth.users, since
-- students carries no email of its own.
update students s
set naale_role = r.role
from auth.users u
join naale_roster r on r.email = u.email
where s.auth_user_id = u.id
  and s.class_id in (select id from classes where track = 'naale')
  and s.naale_role is null;
