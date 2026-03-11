import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import type { UserRole } from '../types';
import { createClient } from '@supabase/supabase-js';

// Create a secondary client for admin creation so it doesn't log the current user out
const adminSupabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  { auth: { persistSession: false, autoRefreshToken: false } }
);

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title: string;
}

export function UserModal({ isOpen, onClose, onSuccess, title }: UserModalProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    login_phone: '',
    password: '',
    role: 'receptionist' as UserRole,
    // Doctor specific fields
    degrees: '',
    specialization: '',
    current_job_title: '',
    institution: '',
    phone_number: '',
    bmdc_number: '',
    // Notification preferences
    notify_new_visits: false,
    notify_new_tests: false,
    notify_own_visits_only: false,
    notify_own_tests_only: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    const name = e.target.name;
    
    setFormData((prev) => {
      const newData = { ...prev, [name]: value };
      
      // If role changed to doctor, automatically check the notification boxes
      if (name === 'role' && value === 'doctor') {
        newData.notify_new_visits = true;
        newData.notify_new_tests = true;
      }
      
      return newData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Create auth user using secondary client
      const signUpOptions: any = {
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
            role: formData.role,
          },
        },
      };

      if (formData.email) {
        signUpOptions.email = formData.email;
      } else if (formData.login_phone) {
        // Create a shadow email to bypass SMS requirements
        signUpOptions.email = `${formData.login_phone}@hospital.local`;
      } else {
        throw new Error("Either Email or Phone is required.");
      }

      const { data: authData, error: authError } = await adminSupabase.auth.signUp(signUpOptions);

      if (authError) throw authError;

      const newUserId = authData.user?.id;
      if (!newUserId) throw new Error("Failed to get new user ID");

      // Note: The `handle_new_user` trigger in the database will automatically create 
      // the profile record. We just need to wait a tiny bit or let it be.
      // Wait for trigger to create profile
      await new Promise(resolve => setTimeout(resolve, 600)); 

      // Update profile with notification settings
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          phone: formData.login_phone || null,
          email: formData.email || null,
          notify_new_visits: formData.notify_new_visits,
          notify_new_tests: formData.notify_new_tests,
          notify_own_visits_only: formData.notify_own_visits_only,
          notify_own_tests_only: formData.notify_own_tests_only
        })
        .eq('id', newUserId);
        
      if (profileError) console.error("Could not update profile notifications", profileError);

      if (formData.role === 'doctor') {
        const { error: doctorError } = await supabase
          .from('doctors_info')
          .insert({
            id: newUserId,
            degrees: formData.degrees,
            specialization: formData.specialization,
            current_job_title: formData.current_job_title,
            institution: formData.institution,
            phone_number: formData.phone_number,
            bmdc_number: formData.bmdc_number || null,
          });

        if (doctorError) throw doctorError;
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'An error occurred while creating the user.');
    } finally {
      setLoading(false);
    }
  };

  // Determine allowed roles to create based on current user's role
  const allowedRoles = profile?.role === 'super_admin' 
    ? ['super_admin', 'diag_manager', 'doctor', 'account_manager', 'receptionist']
    : ['diag_manager', 'doctor', 'account_manager', 'receptionist'];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      {error && (
        <div className="mb-6 p-4 bg-error-50 text-error-700 rounded-xl border border-error-200 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input 
            label="Full Name" 
            name="full_name" 
            required 
            value={formData.full_name} 
            onChange={handleChange} 
          />
          <Input 
            label="Login Phone (01...)" 
            name="login_phone" 
            required={!formData.email}
            value={formData.login_phone} 
            onChange={handleChange} 
            placeholder="e.g. 01XXXXXXXXX"
          />
        </div>

        <Input 
          label="Email Address (Optional if phone provided)" 
          name="email" 
          type="email" 
          required={!formData.login_phone}
          value={formData.email} 
          onChange={handleChange} 
          placeholder="admin@hospital.com"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input 
            label="Password" 
            name="password" 
            type="password" 
            required 
            value={formData.password} 
            onChange={handleChange} 
            minLength={6}
            placeholder="••••••••"
          />
          
          <div className="w-full">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Role
            </label>
            <select
              name="role"
              required
              value={formData.role}
              onChange={handleChange}
              className="appearance-none block w-full px-3 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white/50 focus:bg-white cursor-pointer"
            >
              {allowedRoles.map(role => (
                <option key={role} value={role}>
                  {role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(profile?.role === 'super_admin' || profile?.role === 'diag_manager') && (
          <div className="mt-4 p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
            <h4 className="text-sm font-semibold text-slate-800">Notification Preferences</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input 
                  type="checkbox" 
                  name="notify_new_visits"
                  checked={formData.notify_new_visits}
                  onChange={handleChange}
                  className="rounded text-primary-600 focus:ring-primary-500" 
                />
                Receive New Visit Alerts
              </label>

              {formData.role === 'doctor' && (
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer ml-4">
                  <input 
                    type="checkbox" 
                    name="notify_own_visits_only"
                    checked={formData.notify_own_visits_only}
                    onChange={handleChange}
                    className="rounded text-secondary-600 focus:ring-secondary-500" 
                  />
                  Own Patients Only
                </label>
              )}

              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input 
                  type="checkbox" 
                  name="notify_new_tests"
                  checked={formData.notify_new_tests}
                  onChange={handleChange}
                  className="rounded text-primary-600 focus:ring-primary-500" 
                />
                Receive New Test Alerts
              </label>

              {formData.role === 'doctor' && (
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer ml-4">
                  <input 
                    type="checkbox" 
                    name="notify_own_tests_only"
                    checked={formData.notify_own_tests_only}
                    onChange={handleChange}
                    className="rounded text-secondary-600 focus:ring-secondary-500" 
                  />
                  Own Patients Only
                </label>
              )}
            </div>
          </div>
        )}

        {formData.role === 'doctor' && (
          <div className="mt-6 pt-6 border-t border-slate-100 space-y-4 animate-fade-in-up">
            <h4 className="font-semibold text-slate-800 text-sm tracking-wide uppercase">
              Doctor Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input 
                label="Degrees" 
                name="degrees" 
                required 
                value={formData.degrees} 
                onChange={handleChange} 
                placeholder="e.g. MBBS, MD"
              />
              <Input 
                label="Specialization" 
                name="specialization" 
                required 
                value={formData.specialization} 
                onChange={handleChange} 
                placeholder="e.g. Cardiology"
              />
            </div>
            
            <Input 
              label="Current Job Title" 
              name="current_job_title" 
              required 
              value={formData.current_job_title} 
              onChange={handleChange} 
              placeholder="e.g. Senior Consultant"
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input 
                label="Institution" 
                name="institution" 
                required 
                value={formData.institution} 
                onChange={handleChange} 
              />
              <Input 
                label="BMDC Number (Optional)" 
                name="bmdc_number" 
                value={formData.bmdc_number} 
                onChange={handleChange} 
                placeholder="e.g. A-12345"
              />
            </div>
            <Input 
              label="Phone Number (Optional)" 
              name="phone_number" 
              value={formData.phone_number} 
              onChange={handleChange} 
            />
          </div>
        )}

        <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-slate-100">
          <Button variant="ghost" type="button" onClick={onClose} className="cursor-pointer">
            Cancel
          </Button>
          <Button type="submit" isLoading={loading} className="cursor-pointer">
            Create User
          </Button>
        </div>
      </form>
    </Modal>
  );
}
