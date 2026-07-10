-- Security fix for a bug FOUND via live testing (not just code review): the
-- original policy's first branch let ANY teacher with a class_teachers row
-- — including one scoped to a specific lesson_group — subscribe to the
-- whole-class 'class:{id}:all' broadcast channel, since that branch never
-- checked whether the teacher's own lesson_group was null. A group-2
-- teacher could bypass their intended scoping by subscribing directly to
-- class:1:all instead of class:1:group:2, and would then receive every
-- group's activity. Confirmed empirically with two disposable test
-- teachers (real Supabase Auth sessions, real subscribe/broadcast) before
-- writing this fix.
--
-- Run this ONCE in the Supabase Dashboard → SQL Editor. Safe to run even if
-- migration_realtime_teacher_monitor_rls.sql was already applied — this
-- replaces that same policy with a corrected version.

drop policy if exists "teacher_reads_own_class_monitor_channel" on realtime.messages;

create policy "teacher_reads_own_class_monitor_channel"
on realtime.messages for select
to authenticated
using (
  exists (
    select 1 from class_teachers ct
    where ct.teacher_email = (select auth.jwt() ->> 'email')
      and ct.lesson_group is null
      and realtime.topic() = 'class:' || ct.class_id::text || ':all'
  )
  or exists (
    select 1 from class_teachers ct
    where ct.teacher_email = (select auth.jwt() ->> 'email')
      and ct.lesson_group is not null
      and realtime.topic() = 'class:' || ct.class_id::text || ':group:' || ct.lesson_group::text
  )
  or exists (
    select 1 from admins a
    where a.email = (select auth.jwt() ->> 'email')
      and realtime.topic() like 'class:%:all'
  )
);

-- Sanity check
select * from pg_policies where schemaname = 'realtime' and tablename = 'messages';
