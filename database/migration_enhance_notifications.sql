-- Migration to enhance notification details and add report triggers

-- 1. Function to get detailed visit notification message
CREATE OR REPLACE FUNCTION public.get_visit_notification_message(visit_id UUID)
RETURNS TEXT AS $$
DECLARE
  p_name TEXT;
  d_name TEXT;
  v_date DATE;
BEGIN
  SELECT p.name, pr.full_name, v.visit_date 
  INTO p_name, d_name, v_date
  FROM visits v
  JOIN patients p ON v.patient_id = p.id
  JOIN profiles pr ON v.doctor_id = pr.id
  WHERE v.id = visit_id;

  RETURN p_name || ' scheduled for ' || d_name || ' on ' || v_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Function to get detailed bill notification message
CREATE OR REPLACE FUNCTION public.get_bill_notification_message(bill_id UUID)
RETURNS TEXT AS $$
DECLARE
  p_name TEXT;
  test_list TEXT;
  t_amount DECIMAL;
BEGIN
  SELECT p.name, b.total_amount
  INTO p_name, t_amount
  FROM bills b
  JOIN patients p ON b.patient_id = p.id
  WHERE b.id = bill_id;

  SELECT string_agg(test_name, ', ')
  INTO test_list
  FROM bill_items
  WHERE bill_id = bill_id;

  RETURN p_name || ' - [' || COALESCE(test_list, 'No Tests') || '] - ৳' || t_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update public.notify_new_visit_trigger() to use detailed message
CREATE OR REPLACE FUNCTION public.notify_new_visit_trigger()
RETURNS trigger AS $$
DECLARE
  creator_role TEXT;
  doctor_is_admin BOOLEAN;
  detailed_message TEXT;
BEGIN
  SELECT role INTO creator_role FROM profiles WHERE id = new.receptionist_id;
  SELECT (role = 'super_admin') INTO doctor_is_admin FROM profiles WHERE id = new.doctor_id;
  
  -- Get detailed message
  detailed_message := public.get_visit_notification_message(new.id);
  
  INSERT INTO public.notifications (user_id, title, message, type, related_entity_id)
  SELECT 
    p.id, 
    'New Patient Visit', 
    detailed_message, 
    'visit', 
    new.id
  FROM public.profiles p
  WHERE 
    ((COALESCE(creator_role, '') = 'super_admin' OR COALESCE(doctor_is_admin, false) = true)
     AND p.role = 'super_admin' 
     AND (p.notify_new_visits = true AND p.notify_own_visits_only = false))
    OR
    (NOT (COALESCE(creator_role, '') = 'super_admin' OR COALESCE(doctor_is_admin, false) = true)
     AND (
       (p.notify_new_visits = true AND p.notify_own_visits_only = false) 
       OR 
       (p.notify_own_visits_only = true AND p.id = new.doctor_id)
     ));
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update public.notify_new_bill_trigger() to use detailed message
CREATE OR REPLACE FUNCTION public.notify_new_bill_trigger()
RETURNS trigger AS $$
DECLARE
  creator_role TEXT;
  detailed_message TEXT;
BEGIN
  SELECT role INTO creator_role FROM profiles WHERE id = new.receptionist_id;
  
  -- Get detailed message
  detailed_message := public.get_bill_notification_message(new.id);

  INSERT INTO public.notifications (user_id, title, message, type, related_entity_id)
  SELECT 
    p.id, 
    'New Test Billed', 
    detailed_message, 
    'test', 
    new.id
  FROM public.profiles p
  WHERE 
    (COALESCE(creator_role, '') = 'super_admin' AND p.role = 'super_admin' AND p.notify_new_tests = true AND p.notify_own_tests_only = false)
    OR
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
