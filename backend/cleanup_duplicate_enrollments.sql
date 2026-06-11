-- Cleanup duplicate enrollments created by the broken register form (2026-06-04).
-- Keeps the EARLIEST copy of each unique person; deletes the rest.
--
-- Safe to review before running. Wrapped in a transaction: it prints what it
-- WILL delete and then COMMITs. Change the final COMMIT to ROLLBACK for a dry run.
--
-- Run with:
--   PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d moeys \
--     -v ON_ERROR_STOP=1 -f cleanup_duplicate_enrollments.sql
--
-- A CSV backup of every deleted enrollment row is written to /tmp first.

\set ON_ERROR_STOP on

BEGIN;

-- 1. Identify duplicates: every copy except the earliest (min id) per person.
CREATE TEMP TABLE del_enroll ON COMMIT DROP AS
SELECT id FROM (
  SELECT id,
         row_number() OVER (
           PARTITION BY kh_family_name, kh_given_name, en_family_name,
                        en_given_name, phonenumber, date_of_birth
           ORDER BY id
         ) AS rn
  FROM enrollments
) t
WHERE rn > 1;

-- 2. Report impact.
SELECT count(*) AS enrollments_to_delete FROM del_enroll;

-- 3. Backup the enrollment rows being deleted (full row) to CSV.
\copy (SELECT e.* FROM enrollments e JOIN del_enroll d ON e.id = d.id ORDER BY e.id) TO '/tmp/deleted_enrollments_backup.csv' WITH CSV HEADER;

-- 4. Delete participation rows first (their FK to athletes/leaders is SET NULL,
--    so a cascade would orphan them instead of removing them).
DELETE FROM athlete_participation
WHERE athletes_id IN (
  SELECT id FROM athletes WHERE enroll_id IN (SELECT id FROM del_enroll)
);

DELETE FROM leader_participation
WHERE leaders_id IN (
  SELECT id FROM leaders WHERE enroll_id IN (SELECT id FROM del_enroll)
);

-- 5. Delete the duplicate enrollments. athletes/leaders rows cascade automatically.
DELETE FROM enrollments WHERE id IN (SELECT id FROM del_enroll);

-- 6. Verify no duplicates remain.
SELECT count(*) AS remaining_enrollments FROM enrollments;
SELECT count(*) AS remaining_dup_groups FROM (
  SELECT 1 FROM enrollments
  GROUP BY kh_family_name, kh_given_name, en_family_name, en_given_name,
           phonenumber, date_of_birth
  HAVING count(*) > 1
) g;

-- Change to ROLLBACK; for a dry run.
COMMIT;
