-- migration_fix_billing_and_profile.sql

-- 1. Ensure bill_items has needed columns (in case table existed but was old)
DO $$ 
BEGIN 
  -- Check expected_delivery
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bill_items' AND column_name='expected_delivery') THEN
    ALTER TABLE bill_items ADD COLUMN expected_delivery TIMESTAMPTZ;
  END IF;

  -- Check report_status
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bill_items' AND column_name='report_status') THEN
    ALTER TABLE bill_items ADD COLUMN report_status TEXT DEFAULT 'Pending' CHECK (report_status IN ('Pending', 'Processing', 'Ready', 'Delivered'));
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
    public.get_my_role() IN ('super_admin', 'diag_manager', 'receptionist', 'account_manager', 'doctor')
  )
);

-- 5. Update profiles RLS
DROP POLICY IF EXISTS "Allow authenticated read access" ON profiles;
CREATE POLICY "Allow authenticated read access" ON profiles FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    public.get_my_role() = 'super_admin' OR 
    (public.get_my_role() = 'diag_manager' AND role != 'super_admin') OR
    (public.get_my_role() NOT IN ('super_admin', 'diag_manager') AND id = auth.uid()) OR
    (public.get_my_role() IN ('receptionist', 'doctor', 'account_manager') AND role IN ('doctor', 'receptionist', 'diag_manager', 'super_admin'))
  )
);

DROP POLICY IF EXISTS "Allow users to update own profile" ON profiles;
CREATE POLICY "Allow users to update own profile" ON profiles FOR UPDATE USING (
  auth.uid() = id
) WITH CHECK (
  auth.uid() = id
);

-- 6. Update doctors_info RLS
DROP POLICY IF EXISTS "Allow authenticated read doctors" ON doctors_info;
DROP POLICY IF EXISTS "Allow selective doctor_info access" ON doctors_info;
CREATE POLICY "Allow selective doctor_info access" ON doctors_info FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    public.get_my_role() = 'super_admin' OR
    (public.get_my_role() = 'diag_manager' AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = doctors_info.id AND profiles.role != 'super_admin'
    )) OR
    public.get_my_role() NOT IN ('super_admin', 'diag_manager')
  )
);

DROP POLICY IF EXISTS "Allow super_admin all" ON doctors_info;
CREATE POLICY "Allow super_admin all" ON doctors_info FOR ALL USING (
  public.get_my_role() = 'super_admin'
);

DROP POLICY IF EXISTS "Allow diag_manager all non-admins" ON doctors_info;
CREATE POLICY "Allow diag_manager all non-admins" ON doctors_info FOR ALL USING (
  public.get_my_role() = 'diag_manager' AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = doctors_info.id AND profiles.role != 'super_admin'
  )
);
