-- Database Schema for Smart Hospital and Diagnostic Management System

-- 1. Profiles Table (Extends Supabase Auth Auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'diag_manager', 'receptionist', 'account_manager', 'doctor')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notify_new_visits BOOLEAN DEFAULT false,
  notify_new_tests BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist in case table was created before notifications feature
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_new_visits BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_new_tests BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. Doctors Info Table (Supplementary info for doctors)
CREATE TABLE IF NOT EXISTS doctors_info (
  id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  degrees TEXT NOT NULL,
  specialization TEXT NOT NULL,
  current_job_title TEXT NOT NULL,
  institution TEXT NOT NULL,
  phone_number TEXT,
  bmdc_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure optional columns exist if table was created earlier
ALTER TABLE doctors_info ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE doctors_info ADD COLUMN IF NOT EXISTS bmdc_number TEXT;

-- 3. Tests Table (Managed by Super Admin / Diag Manager)
CREATE TABLE IF NOT EXISTS tests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  discount_percentage DECIMAL(5, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Patients Table
CREATE TABLE IF NOT EXISTS patients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  age INTEGER,
  gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
  blood_group TEXT CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure missing columns exist in patients table
ALTER TABLE patients ADD COLUMN IF NOT EXISTS blood_group TEXT CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'));

-- 5. Visits Table (Doctor Appointments)
CREATE TABLE IF NOT EXISTS visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  receptionist_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'in_progress', 'completed', 'cancelled')),
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  serial_number INTEGER,
  session TEXT CHECK (session IN ('Morning', 'Evening')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Bills Table
CREATE TABLE IF NOT EXISTS bills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  receptionist_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  total_discount DECIMAL(10, 2) DEFAULT 0.00,
  total_amount DECIMAL(10, 2) NOT NULL,
  amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  amount_due DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  estimate_delivery_date TIMESTAMPTZ,
  status TEXT DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Bill Items Table (Junction for Bills and Tests)
CREATE TABLE IF NOT EXISTS bill_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id UUID REFERENCES bills(id) ON DELETE CASCADE,
  test_id UUID REFERENCES tests(id) ON DELETE SET NULL,
  test_name TEXT NOT NULL, -- Stored historically in case test name changes
  price DECIMAL(10, 2) NOT NULL,
  discount DECIMAL(10, 2) DEFAULT 0.00,
  final_price DECIMAL(10, 2) NOT NULL,
  expected_delivery TIMESTAMPTZ,
  report_status TEXT DEFAULT 'Pending' CHECK (report_status IN ('Pending', 'Processing', 'Ready', 'Delivered')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Receptionist Logs Table
CREATE TABLE IF NOT EXISTS receptionist_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  receptionist_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  login_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  logout_time TIMESTAMPTZ,
  date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- 9. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('visit', 'test', 'system')),
  is_read BOOLEAN DEFAULT false,
  related_entity_id UUID, -- Can link to a visit_id or test_id
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  assigned_role TEXT;
  notifications_enabled BOOLEAN;
BEGIN
  assigned_role := COALESCE(new.raw_user_meta_data->>'role', 'super_admin');
  -- Doctors get notifications by default
  notifications_enabled := (assigned_role = 'doctor');

  INSERT INTO public.profiles (
    id, 
    full_name, 
    role, 
    notify_new_visits, 
    notify_new_tests,
    notify_own_visits_only,
    notify_own_tests_only
  )
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'System User'), 
    assigned_role,
    notifications_enabled,
    notifications_enabled,
    false,
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically add profile record when auth.user created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE receptionist_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Security definer function to get the user's role safely
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated read access" ON profiles;
DROP POLICY IF EXISTS "Allow super_admin all" ON profiles;
DROP POLICY IF EXISTS "Allow diag_manager select/update non-admins" ON profiles;
DROP POLICY IF EXISTS "Allow diag_manager all non-admins" ON profiles;
DROP POLICY IF EXISTS "Allow users to update own profile" ON profiles;
DROP POLICY IF EXISTS "Allow authenticated read doctors" ON doctors_info;
DROP POLICY IF EXISTS "Allow authenticated all" ON doctors_info;
DROP POLICY IF EXISTS "Allow authenticated all" ON tests;
DROP POLICY IF EXISTS "Allow authenticated all" ON patients;
DROP POLICY IF EXISTS "Allow selective visit access" ON visits;
DROP POLICY IF EXISTS "Allow authenticated insert" ON visits;
DROP POLICY IF EXISTS "Allow authenticated update" ON visits;
DROP POLICY IF EXISTS "Allow selective bill access" ON bills;
DROP POLICY IF EXISTS "Allow authenticated insert" ON bills;
DROP POLICY IF EXISTS "Allow authenticated update" ON bills;
DROP POLICY IF EXISTS "Allow authenticated all" ON bill_items;
DROP POLICY IF EXISTS "Allow selective log access" ON receptionist_logs;
DROP POLICY IF EXISTS "Allow authenticated all" ON receptionist_logs;
DROP POLICY IF EXISTS "Allow selective notification access" ON notifications;
DROP POLICY IF EXISTS "Allow authenticated all" ON notifications;

-- RLS Policies for Profiles
CREATE POLICY "Allow authenticated read access" ON profiles FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    public.get_my_role() = 'super_admin' OR 
    (public.get_my_role() = 'diag_manager' AND role != 'super_admin') OR
    (public.get_my_role() NOT IN ('super_admin', 'diag_manager') AND id = auth.uid()) OR
    (public.get_my_role() IN ('receptionist', 'doctor', 'account_manager') AND role = 'doctor')
  )
);

CREATE POLICY "Allow super_admin all" ON profiles FOR ALL USING (
  public.get_my_role() = 'super_admin'
);

CREATE POLICY "Allow diag_manager all non-admins" ON profiles FOR ALL USING (
  public.get_my_role() = 'diag_manager' AND role != 'super_admin'
);

CREATE POLICY "Allow users to update own profile" ON profiles FOR UPDATE USING (
  auth.uid() = id
);

-- RLS Policies for Doctors Info
CREATE POLICY "Allow authenticated read doctors" ON doctors_info FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    public.get_my_role() = 'super_admin' OR
    (public.get_my_role() = 'diag_manager' AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = doctors_info.id AND profiles.role != 'super_admin'
    )) OR
    public.get_my_role() NOT IN ('super_admin', 'diag_manager')
  )
);

CREATE POLICY "Allow authenticated all" ON tests FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated all" ON patients FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for Visits
CREATE POLICY "Allow selective visit access" ON visits FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    public.get_my_role() = 'super_admin' OR
    (public.get_my_role() = 'diag_manager' AND NOT EXISTS (
      SELECT 1 FROM profiles 
      WHERE id IN (visits.doctor_id, visits.receptionist_id) 
      AND role = 'super_admin'
    )) OR
    (public.get_my_role() NOT IN ('super_admin', 'diag_manager') AND (
      visits.doctor_id = auth.uid() OR visits.receptionist_id = auth.uid()
    ))
  )
);

CREATE POLICY "Allow authenticated insert" ON visits FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update" ON visits FOR UPDATE USING (auth.role() = 'authenticated');

-- RLS Policies for Bills
CREATE POLICY "Allow selective bill access" ON bills FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    public.get_my_role() IN ('super_admin', 'diag_manager', 'receptionist', 'account_manager')
  )
);

CREATE POLICY "Allow authenticated insert" ON bills FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update" ON bills FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated all" ON bill_items FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for Receptionist Logs
CREATE POLICY "Allow selective log access" ON receptionist_logs FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    public.get_my_role() = 'super_admin' OR
    (public.get_my_role() = 'diag_manager' AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = receptionist_logs.receptionist_id AND profiles.role != 'super_admin'
    ))
  )
);

-- RLS Policies for Notifications
CREATE POLICY "Allow selective notification access" ON notifications FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    user_id = auth.uid() OR public.get_my_role() = 'super_admin'
  )
);

-- Enable realtime for visits, bills, and notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'visits'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE visits';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'bills'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE bills';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE notifications';
  END IF;
END $$;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_own_visits_only BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_own_tests_only BOOLEAN DEFAULT false;

-- Automatically create notifications for new visits
CREATE OR REPLACE FUNCTION public.notify_new_visit_trigger()
RETURNS trigger AS $$
DECLARE
  creator_role TEXT;
  doctor_is_admin BOOLEAN;
BEGIN
  -- Get role of the receptionist
  SELECT role INTO creator_role FROM profiles WHERE id = new.receptionist_id;
  
  -- Check if doctor is admin
  SELECT (role = 'super_admin') INTO doctor_is_admin FROM profiles WHERE id = new.doctor_id;
  
  -- Insert notifications for users
  INSERT INTO public.notifications (user_id, title, message, type, related_entity_id)
  SELECT 
    p.id, 
    'New Patient Visit', 
    'A new patient visit has been added.', 
    'visit', 
    new.id
  FROM public.profiles p
  WHERE 
    -- Case 1: Participant is a super_admin -> only notify other super_admins
    ((COALESCE(creator_role, '') = 'super_admin' OR COALESCE(doctor_is_admin, false) = true)
     AND p.role = 'super_admin' 
     AND (p.notify_new_visits = true AND p.notify_own_visits_only = false))
    OR
    -- Case 2: No super_admins involved -> notify anyone following normal rules
    (NOT (COALESCE(creator_role, '') = 'super_admin' OR COALESCE(doctor_is_admin, false) = true)
     AND (
       (p.notify_new_visits = true AND p.notify_own_visits_only = false) 
       OR 
       (p.notify_own_visits_only = true AND p.id = new.doctor_id)
     ));
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Automatically create notifications for new bills/tests
CREATE OR REPLACE FUNCTION public.notify_new_bill_trigger()
RETURNS trigger AS $$
DECLARE
  creator_role TEXT;
BEGIN
  -- Get role of the receptionist
  SELECT role INTO creator_role FROM profiles WHERE id = new.receptionist_id;

  -- Insert notifications for users
  INSERT INTO public.notifications (user_id, title, message, type, related_entity_id)
  SELECT 
    p.id, 
    'New Test Billed', 
    'A new test bill has been generated.', 
    'test', 
    new.id
  FROM public.profiles p
  WHERE 
    -- Case 1: Receptionist is a super_admin -> only notify other super_admins
    (COALESCE(creator_role, '') = 'super_admin' AND p.role = 'super_admin' AND p.notify_new_tests = true AND p.notify_own_tests_only = false)
    OR
    -- Case 2: Receptionist is NOT a super_admin -> notify following normal rules
    (COALESCE(creator_role, '') != 'super_admin' AND (
      (p.notify_new_tests = true AND p.notify_own_tests_only = false) 
      OR 
      (p.notify_own_tests_only = true AND EXISTS (
        SELECT 1 FROM public.visits v 
        WHERE v.patient_id = new.patient_id 
        AND v.doctor_id = p.id 
        AND v.visit_date = CURRENT_DATE
      ))
    ));
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- DROP AND RECREATE TRIGGERS
DROP TRIGGER IF EXISTS on_visit_created ON visits;
CREATE TRIGGER on_visit_created
  AFTER INSERT ON visits
  FOR EACH ROW EXECUTE PROCEDURE public.notify_new_visit_trigger();

DROP TRIGGER IF EXISTS on_bill_created ON bills;
CREATE TRIGGER on_bill_created
  AFTER INSERT ON bills
  FOR EACH ROW EXECUTE PROCEDURE public.notify_new_bill_trigger();


-- 10. Global Hospital Settings Table
CREATE TABLE IF NOT EXISTS hospital_settings (
  id INT PRIMARY KEY CHECK (id = 1), -- Enforce single row
  name TEXT NOT NULL DEFAULT 'Smart Hospital',
  address TEXT NOT NULL DEFAULT '123 Health Ave, Medical District',
  contact_info TEXT NOT NULL DEFAULT 'Phone: +880-1234-567890 | Email: contact@smarthospital.com',
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure logo_url exists even if table was created earlier
ALTER TABLE hospital_settings ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Pre-populate the single row if it doesn't exist
INSERT INTO hospital_settings (id, name, address, contact_info)
VALUES (1, 'Smart Hospital', '123 Health Ave, Medical District', 'Phone: +880-1234-567890 | Email: contact@smarthospital.com')
ON CONFLICT (id) DO NOTHING;

-- Policies for hospital_settings
ALTER TABLE hospital_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read access" ON hospital_settings;
DROP POLICY IF EXISTS "Allow admin/manager update" ON hospital_settings;

CREATE POLICY "Allow authenticated read access" ON hospital_settings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow admin/manager update" ON hospital_settings FOR UPDATE USING (public.get_my_role() IN ('super_admin', 'diag_manager'));

-- STORAGE BUCKET SETUP
-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('branding', 'branding', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing storage policies
DROP POLICY IF EXISTS "Branding Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Branding Admin/Manager Upload" ON storage.objects;
DROP POLICY IF EXISTS "Branding Admin/Manager Update" ON storage.objects;
DROP POLICY IF EXISTS "Branding Admin/Manager Delete" ON storage.objects;

-- 3. Create robust storage policies
CREATE POLICY "Branding Public Access" ON storage.objects 
FOR SELECT TO public
USING (bucket_id = 'branding');

CREATE POLICY "Branding Admin/Manager Upload" ON storage.objects 
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'branding' AND 
  public.get_my_role() IN ('super_admin', 'diag_manager')
);

CREATE POLICY "Branding Admin/Manager Update" ON storage.objects 
FOR UPDATE TO authenticated
USING (
  bucket_id = 'branding' AND 
  public.get_my_role() IN ('super_admin', 'diag_manager')
);

CREATE POLICY "Branding Admin/Manager Delete" ON storage.objects 
FOR DELETE TO authenticated
USING (
  bucket_id = 'branding' AND 
  public.get_my_role() IN ('super_admin', 'diag_manager')
);
