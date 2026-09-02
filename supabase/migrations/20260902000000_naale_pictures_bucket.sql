-- Private bucket for the 30 picture-description images (naale-stt-image-storage ticket).
-- storage.objects already has RLS enabled project-wide with no default policies, so a
-- non-public bucket is locked to the service-role client with nothing further to add —
-- same "RLS enabled, zero policies" posture as every naale_* table.
insert into storage.buckets (id, name, public)
values ('naale-pictures', 'naale-pictures', false)
on conflict (id) do nothing;
