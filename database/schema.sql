-- Database Schema for Smart Hospital and Diagnostic Management System

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

----------------------------------------------------
-- CLEANUP EXISTING CONFLICTS (CASCADE)
----------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;


DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_role() CASCADE;
DROP FUNCTION IF EXISTS public.get_visit_notification_message(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_bill_notification_message(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.notify_new_visit_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.notify_new_bill_trigger() CASCADE;

DROP TABLE IF EXISTS public.hospital_settings CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.receptionist_logs CASCADE;
DROP TABLE IF EXISTS public.bill_items CASCADE;
DROP TABLE IF EXISTS public.bills CASCADE;
DROP TABLE IF EXISTS public.visits CASCADE;
DROP TABLE IF EXISTS public.patients CASCADE;
DROP TABLE IF EXISTS public.tests CASCADE;
DROP TABLE IF EXISTS public.doctors_info CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

----------------------------------------------------
-- TABLE CREATION
----------------------------------------------------

-- 1. Profiles Table (Extends Supabase Auth Auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'diag_manager', 'receptionist', 'account_manager', 'doctor')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  max_discount DECIMAL(10, 2) DEFAULT 0.00,
  notify_new_visits BOOLEAN DEFAULT false,
  notify_new_tests BOOLEAN DEFAULT false,
  notify_own_visits_only BOOLEAN DEFAULT false,
  notify_own_tests_only BOOLEAN DEFAULT false,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Doctors Info Table (Supplementary info for doctors)
CREATE TABLE public.doctors_info (
  id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  degrees TEXT NOT NULL,
  specialization TEXT NOT NULL,
  current_job_title TEXT NOT NULL,
  institution TEXT NOT NULL,
  phone_number TEXT,
  bmdc_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tests Table (Managed by Super Admin / Diag Manager)
CREATE TABLE public.tests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  discount_percentage DECIMAL(5, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Patients Table
CREATE TABLE public.patients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  age INTEGER,
  gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
  blood_group TEXT CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Visits Table (Doctor Appointments)
CREATE TABLE public.visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  receptionist_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'in_progress', 'completed', 'cancelled')),
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  serial_number INTEGER,
  session TEXT CHECK (session IN ('Morning', 'Evening')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Bills Table
CREATE TABLE public.bills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  receptionist_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
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
CREATE TABLE public.bill_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id UUID REFERENCES public.bills(id) ON DELETE CASCADE,
  test_id UUID REFERENCES public.tests(id) ON DELETE SET NULL,
  test_name TEXT NOT NULL, -- Stored historically in case test name changes
  price DECIMAL(10, 2) NOT NULL,
  discount DECIMAL(10, 2) DEFAULT 0.00,
  final_price DECIMAL(10, 2) NOT NULL,
  expected_delivery TIMESTAMPTZ,
  report_status TEXT DEFAULT 'Pending' CHECK (report_status IN ('Pending', 'Processing', 'Ready', 'Delivered')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Receptionist Logs Table
CREATE TABLE public.receptionist_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  receptionist_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  login_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  logout_time TIMESTAMPTZ,
  date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- 9. Notifications Table
CREATE TABLE public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('visit', 'test', 'system')),
  is_read BOOLEAN DEFAULT false,
  related_entity_id UUID, -- Can link to a visit_id or test_id
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Global Hospital Settings Table
CREATE TABLE public.hospital_settings (
  id INT PRIMARY KEY CHECK (id = 1), -- Enforce single row
  name TEXT NOT NULL DEFAULT 'Smart Hospital',
  address TEXT NOT NULL DEFAULT '123 Health Ave, Medical District',
  contact_info TEXT NOT NULL DEFAULT 'Phone: +880-1234-567890 | Email: contact@smarthospital.com',
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pre-populate the single row if it doesn't exist
INSERT INTO public.hospital_settings (id, name, address, contact_info)
VALUES (1, 'Smart Hospital', '123 Health Ave, Medical District', 'Phone: +880-1234-567890 | Email: contact@smarthospital.com')
ON CONFLICT (id) DO NOTHING;

----------------------------------------------------
-- FUNCTIONS & TRIGGERS FOR USER SIGNUP
----------------------------------------------------

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
    email,
    role, 
    notify_new_visits, 
    notify_new_tests,
    notify_own_visits_only,
    notify_own_tests_only
  )
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'System User'), 
    new.email,
    assigned_role,
    notifications_enabled,
    notifications_enabled,
    false,
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;
    
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically add profile record when auth.user created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

----------------------------------------------------
-- SECURITY DEFINER ROLE GETTER
----------------------------------------------------

-- Security definer function to get the user's role safely
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
  RETURN user_role;
END;
$$;

----------------------------------------------------
-- ROW LEVEL SECURITY (RLS) & POLICIES
----------------------------------------------------

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receptionist_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_settings ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.profiles;
CREATE POLICY "Allow authenticated read access" ON public.profiles FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    public.get_my_role() = 'super_admin' OR 
    (public.get_my_role() = 'diag_manager' AND role != 'super_admin') OR
    (public.get_my_role() NOT IN ('super_admin', 'diag_manager') AND id = auth.uid()) OR
    (public.get_my_role() IN ('receptionist', 'doctor', 'account_manager') AND role IN ('doctor', 'receptionist', 'diag_manager', 'super_admin'))
  )
);

DROP POLICY IF EXISTS "Allow super_admin all" ON public.profiles;
CREATE POLICY "Allow super_admin all" ON public.profiles FOR ALL USING (
  public.get_my_role() = 'super_admin'
);

DROP POLICY IF EXISTS "Allow diag_manager all non-admins" ON public.profiles;
CREATE POLICY "Allow diag_manager all non-admins" ON public.profiles FOR ALL USING (
  public.get_my_role() = 'diag_manager' AND role != 'super_admin'
);

DROP POLICY IF EXISTS "Allow users to update own profile" ON public.profiles;
CREATE POLICY "Allow users to update own profile" ON public.profiles FOR UPDATE USING (
  auth.uid() = id
) WITH CHECK (
  auth.uid() = id
);

-- 2. Doctors Info Policies
DROP POLICY IF EXISTS "Allow selective doctor_info access" ON public.doctors_info;
CREATE POLICY "Allow selective doctor_info access" ON public.doctors_info FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    public.get_my_role() = 'super_admin' OR
    (public.get_my_role() = 'diag_manager' AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE public.profiles.id = doctors_info.id AND public.profiles.role != 'super_admin'
    )) OR
    public.get_my_role() NOT IN ('super_admin', 'diag_manager')
  )
);

DROP POLICY IF EXISTS "Allow super_admin all" ON public.doctors_info;
CREATE POLICY "Allow super_admin all" ON public.doctors_info FOR ALL USING (
  public.get_my_role() = 'super_admin'
);

DROP POLICY IF EXISTS "Allow diag_manager all non-admins" ON public.doctors_info;
CREATE POLICY "Allow diag_manager all non-admins" ON public.doctors_info FOR ALL USING (
  public.get_my_role() = 'diag_manager' AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE public.profiles.id = doctors_info.id AND public.profiles.role != 'super_admin'
  )
);

-- 3. Tests Policies
DROP POLICY IF EXISTS "Allow authenticated all" ON public.tests;
CREATE POLICY "Allow authenticated all" ON public.tests FOR ALL USING (auth.role() = 'authenticated');

-- 4. Patients Policies
DROP POLICY IF EXISTS "Allow authenticated all" ON public.patients;
CREATE POLICY "Allow authenticated all" ON public.patients FOR ALL USING (auth.role() = 'authenticated');

-- 5. Visits Policies
DROP POLICY IF EXISTS "Allow selective visit access" ON public.visits;
CREATE POLICY "Allow selective visit access" ON public.visits FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    public.get_my_role() = 'super_admin' OR
    (public.get_my_role() = 'diag_manager' AND NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id IN (visits.doctor_id, visits.receptionist_id) 
      AND role = 'super_admin'
    )) OR
    (public.get_my_role() NOT IN ('super_admin', 'diag_manager') AND (
      visits.doctor_id = auth.uid() OR visits.receptionist_id = auth.uid()
    ))
  )
);

DROP POLICY IF EXISTS "Allow authenticated insert" ON public.visits;
CREATE POLICY "Allow authenticated insert" ON public.visits FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated update" ON public.visits;
CREATE POLICY "Allow authenticated update" ON public.visits FOR UPDATE USING (auth.role() = 'authenticated');

-- 6. Bills Policies
DROP POLICY IF EXISTS "Allow selective bill access" ON public.bills;
CREATE POLICY "Allow selective bill access" ON public.bills FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    public.get_my_role() IN ('super_admin', 'diag_manager', 'receptionist', 'account_manager', 'doctor')
  )
);

DROP POLICY IF EXISTS "Allow authenticated insert" ON public.bills;
CREATE POLICY "Allow authenticated insert" ON public.bills FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated update" ON public.bills;
CREATE POLICY "Allow authenticated update" ON public.bills FOR UPDATE USING (auth.role() = 'authenticated');

-- 7. Bill Items Policies
DROP POLICY IF EXISTS "Allow authenticated all" ON public.bill_items;
CREATE POLICY "Allow authenticated all" ON public.bill_items FOR ALL USING (auth.role() = 'authenticated');

-- 8. Receptionist Logs Policies
DROP POLICY IF EXISTS "Allow selective log access" ON public.receptionist_logs;
CREATE POLICY "Allow selective log access" ON public.receptionist_logs FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    public.get_my_role() = 'super_admin' OR
    (public.get_my_role() = 'diag_manager' AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE public.profiles.id = receptionist_logs.receptionist_id AND public.profiles.role != 'super_admin'
    ))
  )
);

DROP POLICY IF EXISTS "Allow authenticated insert" ON public.receptionist_logs;
CREATE POLICY "Allow authenticated insert" ON public.receptionist_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 9. Notifications Policies
DROP POLICY IF EXISTS "Allow selective notification access" ON public.notifications;
CREATE POLICY "Allow selective notification access" ON public.notifications FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    user_id = auth.uid() OR public.get_my_role() = 'super_admin'
  )
);

DROP POLICY IF EXISTS "Allow users to update own notifications" ON public.notifications;
CREATE POLICY "Allow users to update own notifications" ON public.notifications FOR UPDATE USING (
  auth.uid() = user_id
) WITH CHECK (
  auth.uid() = user_id
);

-- 10. Hospital Settings Policies
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.hospital_settings;
CREATE POLICY "Allow public read access" ON public.hospital_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow admin/manager update" ON public.hospital_settings;
CREATE POLICY "Allow admin/manager update" ON public.hospital_settings FOR UPDATE USING (public.get_my_role() IN ('super_admin', 'diag_manager'));

----------------------------------------------------
-- NOTIFICATION TRIGGERS AND HELPER FUNCTIONS
----------------------------------------------------

-- Function to get detailed visit notification message
CREATE OR REPLACE FUNCTION public.get_visit_notification_message(visit_id UUID)
RETURNS TEXT AS $$
DECLARE
  p_name TEXT;
  d_name TEXT;
  v_date DATE;
BEGIN
  SELECT p.name, pr.full_name, v.visit_date 
  INTO p_name, d_name, v_date
  FROM public.visits v
  JOIN public.patients p ON v.patient_id = p.id
  JOIN public.profiles pr ON v.doctor_id = pr.id
  WHERE v.id = visit_id;

  RETURN p_name || ' scheduled for ' || d_name || ' on ' || v_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get detailed bill notification message
CREATE OR REPLACE FUNCTION public.get_bill_notification_message(bill_id UUID)
RETURNS TEXT AS $$
DECLARE
  p_name TEXT;
  test_list TEXT;
  t_amount DECIMAL;
BEGIN
  SELECT p.name, b.total_amount
  INTO p_name, t_amount
  FROM public.bills b
  JOIN public.patients p ON b.patient_id = p.id
  WHERE b.id = bill_id;

  SELECT string_agg(test_name, ', ')
  INTO test_list
  FROM public.bill_items
  WHERE bill_id = bill_id;

  RETURN p_name || ' - [' || COALESCE(test_list, 'No Tests') || '] - ৳' || t_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Automatically create notifications for new visits
CREATE OR REPLACE FUNCTION public.notify_new_visit_trigger()
RETURNS trigger AS $$
DECLARE
  creator_role TEXT;
  doctor_is_admin BOOLEAN;
  detailed_message TEXT;
BEGIN
  -- Get role of the receptionist
  SELECT role INTO creator_role FROM public.profiles WHERE id = new.receptionist_id;
  
  -- Check if doctor is admin
  SELECT (role = 'super_admin') INTO doctor_is_admin FROM public.profiles WHERE id = new.doctor_id;
  
  -- Get detailed message
  detailed_message := public.get_visit_notification_message(new.id);
  
  -- Insert notifications for users
  INSERT INTO public.notifications (user_id, title, message, type, related_entity_id)
  SELECT 
    p.id, 
    'New Patient Visit', 
    detailed_message, 
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
  detailed_message TEXT;
BEGIN
  -- Get role of the receptionist
  SELECT role INTO creator_role FROM public.profiles WHERE id = new.receptionist_id;

  -- Get detailed message
  detailed_message := public.get_bill_notification_message(new.id);

  -- Insert notifications for users
  INSERT INTO public.notifications (user_id, title, message, type, related_entity_id)
  SELECT 
    p.id, 
    'New Test Billed', 
    detailed_message, 
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

-- Bind triggers to tables
DROP TRIGGER IF EXISTS on_visit_created ON public.visits;
CREATE TRIGGER on_visit_created
  AFTER INSERT ON public.visits
  FOR EACH ROW EXECUTE PROCEDURE public.notify_new_visit_trigger();

DROP TRIGGER IF EXISTS on_bill_created ON public.bills;
CREATE TRIGGER on_bill_created
  AFTER INSERT ON public.bills
  FOR EACH ROW EXECUTE PROCEDURE public.notify_new_bill_trigger();

----------------------------------------------------
-- SUPABASE REALTIME CONFIGURATION
----------------------------------------------------

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

----------------------------------------------------
-- STORAGE BUCKETS & STORAGE OBJECT POLICIES
----------------------------------------------------

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

----------------------------------------------------
-- SEED DEFAULT SUPER ADMIN USER
----------------------------------------------------
-- 0. Clean up existing seed user to ensure fresh recreation
DELETE FROM auth.users WHERE email = 'joyonto.karmakar.std@gmail.com';

-- 1. Insert into auth.users (Supabase managed authentication table)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
SELECT 
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'joyonto.karmakar.std@gmail.com',
  crypt('SuperAdmin@1234', gen_salt('bf')),
  now(),
  NULL,
  NULL,
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Super Admin","role":"super_admin"}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'joyonto.karmakar.std@gmail.com'
);

-- 2. Insert into auth.identities (Required by GoTrue to find the email provider during sign-in)
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT 
  id,
  id,
  id,
  format('{"sub":"%s","email":"%s"}', id::text, email)::jsonb,
  'email',
  now(),
  now(),
  now()
FROM auth.users
WHERE email = 'joyonto.karmakar.std@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities WHERE user_id = auth.users.id
  );

-- 3. Fallback: Directly insert into public.profiles to ensure it exists
INSERT INTO public.profiles (
  id,
  full_name,
  email,
  role,
  status,
  notify_new_visits,
  notify_new_tests,
  notify_own_visits_only,
  notify_own_tests_only
)
SELECT 
  id,
  'Super Admin',
  'joyonto.karmakar.std@gmail.com',
  'super_admin',
  'active',
  false,
  false,
  false,
  false
FROM auth.users
WHERE email = 'joyonto.karmakar.std@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'super_admin';

----------------------------------------------------
-- RESTORE DEFAULT SUPABASE ROLE PERMISSIONS
----------------------------------------------------
-- 1. Grant usage on public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Grant table and sequence permissions (RLS still handles row-level access)
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- 3. Grant execution permissions on functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon;

-- 4. Set default privileges for any future tables/functions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated, anon;



