-- Migration: Add email and max_discount to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_discount DECIMAL(10, 2) DEFAULT 0.00;

-- Update existing profiles with email from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- Update handle_new_user trigger to include email
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
