-- Database Schema for Smart Hospital and Diagnostic Management System

-- 1. Profiles Table (Extends Supabase Auth Auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'diag_manager', 'receptionist', 'account_manager', 'doctor')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Doctors Info Table (Supplementary info for doctors)
CREATE TABLE doctors_info (
  id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  degrees TEXT NOT NULL,
  specialization TEXT NOT NULL,
  current_job_title TEXT NOT NULL,
  institution TEXT NOT NULL,
  phone_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tests Table (Managed by Super Admin / Diag Manager)
CREATE TABLE tests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  discount_percentage DECIMAL(5, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Patients Table
CREATE TABLE patients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  age INTEGER,
  gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Visits Table (Doctor Appointments)
CREATE TABLE visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  receptionist_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'in_progress', 'completed', 'cancelled')),
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Bills Table
CREATE TABLE bills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  receptionist_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  total_discount DECIMAL(10, 2) DEFAULT 0.00,
  total_amount DECIMAL(10, 2) NOT NULL,
  status TEXT DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Bill Items Table (Junction for Bills and Tests)
CREATE TABLE bill_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id UUID REFERENCES bills(id) ON DELETE CASCADE,
  test_id UUID REFERENCES tests(id) ON DELETE SET NULL,
  test_name TEXT NOT NULL, -- Stored historically in case test name changes
  price DECIMAL(10, 2) NOT NULL,
  discount DECIMAL(10, 2) DEFAULT 0.00,
  final_price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Receptionist Logs Table
CREATE TABLE receptionist_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  receptionist_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  login_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  logout_time TIMESTAMPTZ,
  date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'System User'), 
    COALESCE(new.raw_user_meta_data->>'role', 'super_admin')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically add profile record when auth.user created
CREATE OR REPLACE TRIGGER on_auth_user_created
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

-- Disable strict RLS initially so we can establish data from frontend easily. 
-- In production, replace `true` with role-based auth.uid() checks.
-- Fix for infinite recursion: Create a security definer function to get the user's role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

CREATE POLICY "Allow authenticated read access" ON profiles FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow super_admin all" ON profiles FOR ALL USING (
  public.get_my_role() = 'super_admin'
);

CREATE POLICY "Allow diag_manager select/update non-admins" ON profiles FOR ALL USING (
  public.get_my_role() = 'diag_manager' AND role != 'super_admin'
);
CREATE POLICY "Allow authenticated all" ON doctors_info FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated all" ON tests FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated all" ON patients FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated all" ON visits FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated all" ON bills FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated all" ON bill_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated all" ON receptionist_logs FOR ALL USING (auth.role() = 'authenticated');

-- Enable realtime for visits and bills
-- Note: Run this manually if it fails in the SQL editor
alter publication supabase_realtime add table visits;
alter publication supabase_realtime add table bills;
