-- migration_fix_billing_and_profile.sql

-- 1. Add estimate_delivery_date to bills table
ALTER TABLE bills ADD COLUMN IF NOT EXISTS estimate_delivery_date TIMESTAMPTZ;

-- 2. Populate estimate_delivery_date from bill_items if available (for existing data)
UPDATE bills b
SET estimate_delivery_date = (
  SELECT expected_delivery 
  FROM bill_items bi 
  WHERE bi.bill_id = b.id 
  LIMIT 1
)
WHERE estimate_delivery_date IS NULL;

-- 3. Update RLS policies for bills to allow better visibility
-- Current policy: "Allow selective bill access"
DROP POLICY IF EXISTS "Allow selective bill access" ON bills;
CREATE POLICY "Allow selective bill access" ON bills FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    public.get_my_role() IN ('super_admin', 'diag_manager', 'receptionist', 'account_manager')
  )
);

-- 4. Ensure profiles RLS allows update of own data (already exists, but reinforcing)
DROP POLICY IF EXISTS "Allow users to update own profile" ON profiles;
CREATE POLICY "Allow users to update own profile" ON profiles FOR UPDATE USING (
  auth.uid() = id
) WITH CHECK (
  auth.uid() = id
);
