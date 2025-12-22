-- Fix RLS policy performance issues
-- 1. Use (select auth.role()) instead of auth.role() to avoid per-row re-evaluation
-- 2. Separate read and write policies to avoid multiple permissive policies on SELECT

-- Drop existing policies
DROP POLICY IF EXISTS "Allow public read" ON subjects;
DROP POLICY IF EXISTS "Allow service role write" ON subjects;
DROP POLICY IF EXISTS "Allow public read" ON disputes;
DROP POLICY IF EXISTS "Allow service role write" ON disputes;
DROP POLICY IF EXISTS "Allow public read" ON juror_records;
DROP POLICY IF EXISTS "Allow service role write" ON juror_records;
DROP POLICY IF EXISTS "Allow public read" ON challenger_records;
DROP POLICY IF EXISTS "Allow service role write" ON challenger_records;
DROP POLICY IF EXISTS "Allow public read" ON defender_records;
DROP POLICY IF EXISTS "Allow service role write" ON defender_records;
DROP POLICY IF EXISTS "Allow public read" ON juror_pools;
DROP POLICY IF EXISTS "Allow service role write" ON juror_pools;
DROP POLICY IF EXISTS "Allow public read" ON challenger_pools;
DROP POLICY IF EXISTS "Allow service role write" ON challenger_pools;
DROP POLICY IF EXISTS "Allow public read" ON defender_pools;
DROP POLICY IF EXISTS "Allow service role write" ON defender_pools;
DROP POLICY IF EXISTS "Allow public read" ON escrows;
DROP POLICY IF EXISTS "Allow service role write" ON escrows;

-- Recreate policies with proper structure
-- Public read access (SELECT only)
CREATE POLICY "public_read" ON subjects FOR SELECT USING (true);
CREATE POLICY "public_read" ON disputes FOR SELECT USING (true);
CREATE POLICY "public_read" ON juror_records FOR SELECT USING (true);
CREATE POLICY "public_read" ON challenger_records FOR SELECT USING (true);
CREATE POLICY "public_read" ON defender_records FOR SELECT USING (true);
CREATE POLICY "public_read" ON juror_pools FOR SELECT USING (true);
CREATE POLICY "public_read" ON challenger_pools FOR SELECT USING (true);
CREATE POLICY "public_read" ON defender_pools FOR SELECT USING (true);
CREATE POLICY "public_read" ON escrows FOR SELECT USING (true);

-- Service role write access (INSERT only) - uses subquery for performance
CREATE POLICY "service_insert" ON subjects FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "service_insert" ON disputes FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "service_insert" ON juror_records FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "service_insert" ON challenger_records FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "service_insert" ON defender_records FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "service_insert" ON juror_pools FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "service_insert" ON challenger_pools FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "service_insert" ON defender_pools FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "service_insert" ON escrows FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');

-- Service role update access - uses subquery for performance
CREATE POLICY "service_update" ON subjects FOR UPDATE USING ((select auth.role()) = 'service_role');
CREATE POLICY "service_update" ON disputes FOR UPDATE USING ((select auth.role()) = 'service_role');
CREATE POLICY "service_update" ON juror_records FOR UPDATE USING ((select auth.role()) = 'service_role');
CREATE POLICY "service_update" ON challenger_records FOR UPDATE USING ((select auth.role()) = 'service_role');
CREATE POLICY "service_update" ON defender_records FOR UPDATE USING ((select auth.role()) = 'service_role');
CREATE POLICY "service_update" ON juror_pools FOR UPDATE USING ((select auth.role()) = 'service_role');
CREATE POLICY "service_update" ON challenger_pools FOR UPDATE USING ((select auth.role()) = 'service_role');
CREATE POLICY "service_update" ON defender_pools FOR UPDATE USING ((select auth.role()) = 'service_role');
CREATE POLICY "service_update" ON escrows FOR UPDATE USING ((select auth.role()) = 'service_role');

-- Service role delete access - uses subquery for performance
CREATE POLICY "service_delete" ON subjects FOR DELETE USING ((select auth.role()) = 'service_role');
CREATE POLICY "service_delete" ON disputes FOR DELETE USING ((select auth.role()) = 'service_role');
CREATE POLICY "service_delete" ON juror_records FOR DELETE USING ((select auth.role()) = 'service_role');
CREATE POLICY "service_delete" ON challenger_records FOR DELETE USING ((select auth.role()) = 'service_role');
CREATE POLICY "service_delete" ON defender_records FOR DELETE USING ((select auth.role()) = 'service_role');
CREATE POLICY "service_delete" ON juror_pools FOR DELETE USING ((select auth.role()) = 'service_role');
CREATE POLICY "service_delete" ON challenger_pools FOR DELETE USING ((select auth.role()) = 'service_role');
CREATE POLICY "service_delete" ON defender_pools FOR DELETE USING ((select auth.role()) = 'service_role');
CREATE POLICY "service_delete" ON escrows FOR DELETE USING ((select auth.role()) = 'service_role');
