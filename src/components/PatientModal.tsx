import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { supabase } from '../lib/supabase';

interface PatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (patientId?: string) => void;
}

export function PatientModal({ isOpen, onClose, onSuccess }: PatientModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    age: '',
    gender: 'Male',
    blood_group: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Check if patient with phone already exists
      const { data: existing } = await supabase
        .from('patients')
        .select('id')
        .eq('phone', formData.phone)
        .maybeSingle();

      if (existing) {
        throw new Error('A patient with this phone number is already registered.');
      }

      const { data, error: insertError } = await supabase
        .from('patients')
        .insert({
          name: formData.name,
          phone: formData.phone,
          age: formData.age ? parseInt(formData.age as string) : null,
          gender: formData.gender,
          blood_group: formData.blood_group || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      
      onSuccess(data.id);
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Register New Patient">
      {error && (
        <div className="mb-6 p-4 bg-error-50 text-error-700 rounded-xl border border-error-200 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input 
          label="Full Name" 
          name="name" 
          required 
          value={formData.name} 
          onChange={handleChange} 
          placeholder="e.g. John Doe"
        />

        <Input 
          label="Phone Number" 
          name="phone" 
          required 
          value={formData.phone} 
          onChange={handleChange} 
          placeholder="e.g. +8801XXXXXXXXX"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input 
            label="Age" 
            name="age" 
            type="number"
            min="0"
            value={formData.age} 
            onChange={handleChange} 
            placeholder="Years"
          />
          <div className="w-full">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Gender
            </label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              className="appearance-none block w-full px-3 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white/50 focus:bg-white"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="w-full">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Blood Group (Optional)
            </label>
            <select
              name="blood_group"
              value={formData.blood_group}
              onChange={handleChange}
              className="appearance-none block w-full px-3 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white/50 focus:bg-white"
            >
              <option value="">Select Blood Group</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-slate-100">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={loading}>
            Register Patient
          </Button>
        </div>
      </form>
    </Modal>
  );
}
