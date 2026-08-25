-- Add chosen_answer to naale_answers so students can review their past mistakes.
-- Nullable: all pre-migration rows get NULL (no backfill possible — we never
-- stored it before). History only exists for answers recorded after this ships.
ALTER TABLE naale_answers ADD COLUMN chosen_answer text;
