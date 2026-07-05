-- Super admins — accounts that can view every class's teacher dashboards
-- (via a class selector), not just one class like a regular teacher.
-- Run this ONCE in the Supabase Dashboard → SQL Editor. Additive and safe:
-- a new table nothing reads until the accompanying code deploys.

create table admins (
  email varchar(255) primary key
);

insert into admins (email) values
  ('adi1hacohen@gmail.com'),
  ('yuvalpeer49@gmail.com');

alter table admins disable row level security;

-- To add/remove an admin later (no deploy needed):
--   insert into admins (email) values ('name@gmail.com');
--   delete from admins where email = 'name@gmail.com';

-- Sanity check
select * from admins order by email;
