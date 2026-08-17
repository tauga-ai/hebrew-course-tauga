-- Naale-track admin allowlist. Separate from `admins` (teacher-dashboard
-- super-admins) so the two permissions never imply each other, and separate
-- from `naale_roster` (students/staff) so an admin needs no students row.
-- RLS disabled: read only via the service-role client (requireNaaleAdmin()),
-- never from the browser — same convention as `admins`.

create table naale_admins (
  email varchar(255) primary key,
  created_at timestamptz not null default now()
);

alter table naale_admins disable row level security;

insert into naale_admins (email) values ('tacujan.andrei@gmail.com');
-- Add Yuval's and Noam's confirmed addresses here once known:
-- insert into naale_admins (email) values ('name@example.com');
