-- Add missing indexes for performance optimization
-- Run: psql -U <user> -d <database> -f 001_add_indexes.sql

-- 1. GIN index for phone number LIKE searches (requires pg_trgm extension)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enrollments_phonenumber_trgm
    ON enrollments USING gin (phonenumber gin_trgm_ops);

-- 2. Composite indexes on join/filter columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_athlete_participation_org_event
    ON athlete_participation (organization_id, events_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leader_participation_org_event
    ON leader_participation (organization_id, events_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_participation_per_sport_org
    ON participation_per_sport (org_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_participation_per_sport_sports_events
    ON participation_per_sport (sports_Events_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sports_event_org_composite
    ON sports_event_org (events_id, sports_id, organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sports_event_composite
    ON sports_event (events_id, sports_id);

-- 3. DESC index for recent enrollment queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enrollments_created_at_desc
    ON enrollments (created_at DESC);

-- 4. Indexes on search columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enrollments_kh_name
    ON enrollments USING gin (kh_family_name gin_trgm_ops, kh_given_name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enrollments_en_name
    ON enrollments USING gin (en_family_name gin_trgm_ops, en_given_name gin_trgm_ops);

-- 5. Index for athlete participation sport/event lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_athlete_participation_sport_event
    ON athlete_participation (sports_id, events_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leader_participation_sport_event
    ON leader_participation (sports_id, events_id);
