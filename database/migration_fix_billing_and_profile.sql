-- migration_fix_billing_and_profile.sql

-- 1. Ensure bill_items has expected_delivery column (in case table existed but was old)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bill_items' AND column_name='expected_delivery') THEN
    ALTER TABLE bill_items ADD COLUMN expected_delivery TIMESTAMPTZ;
  END IF;
END $$;

-- 2. Add estimate_delivery_date to bills table if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bills' AND column_name='estimate_delivery_date') THEN
    ALTER TABLE bills ADD COLUMN estimate_delivery_date TIMESTAMPTZ;
  END IF;
END $$;

-- 3. Populate estimate_delivery_date from bill_items if available (for existing data)
UPDATE bills b
SET estimate_delivery_date = (
  SELECT expected_delivery 
  FROM bill_items bi 
  WHERE bi.bill_id = b.id 
  AND expected_delivery IS NOT NULL
  LIMIT 1
)
WHERE estimate_delivery_date IS NULL;

-- 4. Update RLS policies for bills
DROP POLICY IF EXISTS "Allow selective bill access" ON bills;
CREATE POLICY "Allow selective bill access" ON bills FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    public.get_my_role() IN ('super_admin', 'diag_manager', 'receptionist', 'account_manager')
  )
);

-- 5. Update profiles RLS
DROP POLICY IF EXISTS "Allow users to update own profile" ON profiles;
CREATE POLICY "Allow users to update own profile" ON profiles FOR UPDATE USING (
  auth.uid() = id
) WITH CHECK (
  auth.uid() = id
);
