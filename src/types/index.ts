
export type UserRole = 'super_admin' | 'diag_manager' | 'receptionist' | 'account_manager' | 'doctor';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface DoctorInfo {
  id: string;
  degrees: string;
  specialization: string;
  current_job_title: string;
  institution: string;
  phone_number?: string;
}

// More types will be added as needed based on schema.sql
