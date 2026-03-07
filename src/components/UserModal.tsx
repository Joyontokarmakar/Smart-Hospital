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
    email: '',
    password: '',
    full_name: '',
    role: 'receptionist' as UserRole,
    // Doctor specific fields
    degrees: '',
    specialization: '',
    current_job_title: '',
    institution: '',
    phone_number: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Create auth user using secondary client
      const { data: authData, error: authError } = await adminSupabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
            role: formData.role,
          },
        },
      });

      if (authError) throw authError;

      const newUserId = authData.user?.id;
      if (!newUserId) throw new Error("Failed to get new user ID");

      // Note: The `handle_new_user` trigger in the database will automatically create 
      // the profile record. We just need to wait a tiny bit or let it be.
      // However, if it's a doctor, we MUST insert into doctors_info.
      
      if (formData.role === 'doctor') {
        // give trigger a moment just in case
        await new Promise(resolve => setTimeout(resolve, 500)); 

        const { error: doctorError } = await supabase
          .from('doctors_info')
          .insert({
            id: newUserId,
            degrees: formData.degrees,
            specialization: formData.specialization,
            current_job_title: formData.current_job_title,
            institution: formData.institution,
            phone_number: formData.phone_number,
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
    ? ['diag_manager', 'doctor', 'account_manager', 'receptionist']
    : ['doctor', 'account_manager', 'receptionist'];

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
            label="Email Address" 
            name="email" 
            type="email" 
            required 
            value={formData.email} 
            onChange={handleChange} 
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input 
            label="Password" 
            name="password" 
            type="password" 
            required 
            value={formData.password} 
            onChange={handleChange} 
            minLength={6}
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
              className="appearance-none block w-full px-3 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white/50 focus:bg-white"
            >
              {allowedRoles.map(role => (
                <option key={role} value={role}>
                  {role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
        </div>

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
                label="Phone Number (Optional)" 
                name="phone_number" 
                value={formData.phone_number} 
                onChange={handleChange} 
              />
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-slate-100">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={loading}>
            Create User
          </Button>
        </div>
      </form>
    </Modal>
  );
}
