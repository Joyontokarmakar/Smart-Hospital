export type UserRole = 'super_admin' | 'diag_manager' | 'receptionist' | 'account_manager' | 'doctor';

export interface Profile {
  id: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  status: 'active' | 'inactive';
  notify_new_visits?: boolean;
  notify_new_tests?: boolean;
  notify_own_visits_only?: boolean;
  notify_own_tests_only?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Patient {
  id: string;
  name: string;
  phone: string;
  age?: number;
  gender?: 'Male' | 'Female' | 'Other';
  blood_group?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  created_at: string;
}

export interface DoctorInfo {
  id: string;
  degrees: string;
  specialization: string;
  current_job_title: string;
  institution: string;
  phone_number?: string;
  bmdc_number?: string;
}

export interface Visit {
  id: string;
  patient_id: string;
  doctor_id: string;
  receptionist_id: string;
  status: 'queued' | 'in_progress' | 'completed' | 'cancelled';
  visit_date: string;
  serial_number?: number;
  session?: 'Morning' | 'Evening';
  created_at: string;
  
  // Joins
  patient?: Patient;
  doctor?: Profile;
}

export interface Bill {
  id: string;
  patient_id: string;
  receptionist_id: string;
  subtotal: number;
  total_discount: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  status: 'paid' | 'pending' | 'cancelled';
  created_at: string;
  
  // Joins
  patient?: Patient;
  bill_items?: BillItem[];
}

export interface BillItem {
  id: string;
  bill_id: string;
  test_id: string;
  test_name: string;
  price: number;
  discount: number;
  visit_date: string;
  serial_number?: number;
  session?: 'Morning' | 'Evening';
  created_at: string;
  
  // Joins
  patient?: Patient;
  doctor?: Profile;
}


export interface Test {
  id: string;
  name: string;
  price: number;
  discount_percentage: number;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'visit' | 'test' | 'system';
  is_read: boolean;
  related_entity_id?: string;
  created_at: string;
}

export interface HospitalSettings {
  id: number;
  name: string;
  address: string;
  contact_info: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}
