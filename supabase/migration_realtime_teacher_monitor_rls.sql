-- Real-time teacher monitoring ("תרגול בכיתה" live dashboard) — Broadcast
-- Authorization policy. This is the ONLY RLS this feature touches: every
-- application table (students, makbatzim_results, etc.) keeps RLS disabled
-- exactly as today, since all app reads/writes still go through the
-- service-role client. The policy below gates who may SUBSCRIBE to a
-- realtime broadcast channel — the server always broadcasts via the
-- service-role key, which bypasses this (INSERT-side) regardless.
--
-- Channel naming: 'class:{class_id}:all' (whole-class scope — used by
-- admins and by teachers whose class_teachers row has a null lesson_group)
-- and 'class:{class_id}:group:{lesson_group}' (a specific group's teacher).
-- Mirrors exactly how src/lib/teacher-data.ts's getClassAndStudents() scopes
-- reads today: no lesson_group filter when null, filtered when 1/2/3.
--
-- Run this ONCE in the Supabase Dashboard → SQL Editor.

create policy "teacher_reads_own_class_monitor_channel"
on realtime.messages for select
to authenticated
using (
  exists (
    select 1 from class_teachers ct
    where ct.teacher_email = (select auth.jwt() ->> 'email')
      -- Critical: only a whole-class teacher (no lesson_group) may use the
      -- :all channel — without this, a group-scoped teacher could bypass
      -- their own scoping by manually subscribing to class:{id}:all instead
      -- of the group-specific channel the app UI actually uses for them.
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
