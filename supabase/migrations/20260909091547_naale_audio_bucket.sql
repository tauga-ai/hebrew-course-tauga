-- Private bucket for the 53 Listening Comprehension audio clips
-- (naale-listening-comprehension-content). storage.objects already has RLS
-- enabled project-wide with no default policies, so a non-public bucket is
-- locked to the service-role client with nothing further to add — same "RLS
-- enabled, zero policies" posture as naale-pictures.
insert into storage.buckets (id, name, public)
values ('naale-audio', 'naale-audio', false)
on conflict (id) do nothing;
