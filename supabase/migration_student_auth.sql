-- Add authentication columns to students table
-- Run this in Supabase SQL Editor

ALTER TABLE students ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS email TEXT;
