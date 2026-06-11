-- Add token_valid_from column for access token revocation
-- Run: psql -U <user> -d <database> -f 002_add_token_valid_from.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS token_valid_from TIMESTAMPTZ;

-- Set token_valid_from to created_at for existing users so they don't
-- get logged out on deploy
UPDATE users SET token_valid_from = created_at AT TIME ZONE 'UTC' WHERE token_valid_from IS NULL;
