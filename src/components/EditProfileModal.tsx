import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Lock, Check } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
}

export function EditProfileModal({ isOpen, onClose, onSuccess, userId }: EditProfileModalProps) {
  const { profile: currentProfile, user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    role: '',
    notify_new_visits: false,
    notify_new_tests: false,
    notify_own_visits_only: false,
    notify_own_tests_only: false,
    // Doctor specific fields
    degrees: '',
    specialization: '',
    current_job_title: '',
    institution: '',
    phone_number: '',
    bmdc_number: '',
  });

  // Password Change State
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      fetchUserData();
    }
  }, [isOpen, userId]);

  const fetchUserData = async () => {
    setFetching(true);
    setError(null);
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      let doctorData = null;
      if (profileData.role === 'doctor') {
        const { data: dData, error: dError } = await supabase
          .from('doctors_info')
          .select('*')
          .eq('id', userId)
          .single();
        if (dError && dError.code !== 'PGRST116') {
          console.error("Doctor info error", dError);
        } else {
          doctorData = dData;
        }
      }

      setFormData({
        full_name: profileData.full_name || '',
        phone: profileData.phone || '',
        role: profileData.role || '',
        notify_new_visits: profileData.notify_new_visits || false,
        notify_new_tests: profileData.notify_new_tests || false,
        notify_own_visits_only: profileData.notify_own_visits_only || false,
        notify_own_tests_only: profileData.notify_own_tests_only || false,
        degrees: doctorData?.degrees || '',
        specialization: doctorData?.specialization || '',
        current_job_title: doctorData?.current_job_title || '',
        institution: doctorData?.institution || '',
        phone_number: doctorData?.phone_number || '',
        bmdc_number: doctorData?.bmdc_number || '',
      });
    } catch (err: any) {
      setError('Failed to fetch user data: ' + err.message);
    } finally {
      setFetching(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    const name = e.target.name;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }

    setPasswordLoading(true);

    try {
      // 1. Verify current password by signing in again
      const userEmail = currentUser?.email;
      if (!userEmail) throw new Error("Could not identify user email for verification.");

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: passwordForm.currentPassword,
      });

      if (signInError) {
        throw new Error("Current password is incorrect.");
      }

      // 2. Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });

      if (updateError) throw updateError;

      setPasswordSuccess(true);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setShowPasswordChange(false), 2000);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handlePasswordInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Update profile basic info
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone || null,
          notify_new_visits: formData.notify_new_visits,
          notify_new_tests: formData.notify_new_tests,
          notify_own_visits_only: formData.notify_own_visits_only,
          notify_own_tests_only: formData.notify_own_tests_only
        })
        .eq('id', userId);
        
      if (profileError) throw profileError;

      // Update doctor info if they are a doctor
      if (formData.role === 'doctor') {
        const { error: doctorError } = await supabase
          .from('doctors_info')
          .upsert({
            id: userId,
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
      setError(err.message || 'An error occurred while updating the profile.');
    } finally {
      setLoading(false);
    }
  };

  // Determine if current user is allowed to edit notification preferences of this person
  // Usually, a Super Admin or the person themselves can edit these.
  const canEditNotifications = currentProfile?.role === 'super_admin' || currentProfile?.id === userId;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Profile">
      {error && (
        <div className="mb-6 p-4 bg-error-50 text-error-700 rounded-xl border border-error-200 text-sm">
          {error}
        </div>
      )}

      {fetching ? (
        <div className="py-12 text-center text-slate-500">Loading profile data...</div>
      ) : (
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
              label="Phone Number" 
              name="phone" 
              value={formData.phone} 
              onChange={handleChange} 
              placeholder="e.g. 01XXXXXXXXX"
            />
          </div>

          <div className="w-full">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Role
            </label>
            <input
              type="text"
              readOnly
              disabled
              value={formData.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              className="appearance-none block w-full px-3 py-2.5 border border-slate-200 rounded-xl shadow-sm bg-slate-50 text-slate-500 cursor-not-allowed"
            />
          </div>

          {canEditNotifications && (
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
                  label="BMDC Number" 
                  name="bmdc_number" 
                  value={formData.bmdc_number} 
                  onChange={handleChange} 
                  placeholder="e.g. A-12345"
                />
              </div>
              <Input 
                label="Phone Number" 
                name="phone_number" 
                value={formData.phone_number} 
                onChange={handleChange} 
              />
            </div>
          )}

          {/* Change Password Section */}
          {currentUser?.id === userId && (
            <div className="mt-6 pt-6 border-t border-slate-100">
              {!showPasswordChange ? (
                <button
                  type="button"
                  onClick={() => setShowPasswordChange(true)}
                  className="flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  Change Password?
                </button>
              ) : (
                <div className="space-y-4 animate-fade-in-up">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-slate-800 text-sm tracking-wide uppercase flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Change Password
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordChange(false);
                        setPasswordError(null);
                        setPasswordSuccess(false);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  {passwordError && (
                    <div className="p-3 bg-error-50 text-error-700 rounded-lg text-xs border border-error-100">
                      {passwordError}
                    </div>
                  )}

                  {passwordSuccess && (
                    <div className="p-3 bg-success-50 text-success-700 rounded-lg text-xs border border-success-100 flex items-center gap-2">
                      <Check className="w-3 h-3" />
                      Password updated successfully!
                    </div>
                  )}

                  <div className="space-y-3">
                    <Input
                      label="Current Password"
                      name="currentPassword"
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={handlePasswordInputChange}
                      required
                      placeholder="••••••••"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input
                        label="New Password"
                        name="newPassword"
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={handlePasswordInputChange}
                        required
                        placeholder="••••••••"
                      />
                      <Input
                        label="Confirm New Password"
                        name="confirmPassword"
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={handlePasswordInputChange}
                        required
                        placeholder="••••••••"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={handlePasswordChangeSubmit}
                      isLoading={passwordLoading}
                      className="w-full mt-2 cursor-pointer"
                      variant="primary"
                    >
                      Update Password
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-slate-100">
            <Button variant="ghost" type="button" onClick={onClose} className="cursor-pointer">
              Cancel
            </Button>
            <Button type="submit" isLoading={loading} className="cursor-pointer">
              Save Changes
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
