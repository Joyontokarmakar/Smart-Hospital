import { useState, useEffect, useRef } from 'react';
import { Settings, Save, Loader2, Hospital, Upload, X, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../hooks/useAuth';
import type { HospitalSettings } from '../types';

export default function SettingsPage() {
  const { settings, refreshSettings, loading: initialLoading } = useSettings();
  const { profile } = useAuth();
  
  const [formData, setFormData] = useState<Partial<HospitalSettings>>({
    name: '',
    address: '',
    contact_info: '',
    logo_url: '',
  });
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings) {
      setFormData({
        name: settings.name,
        address: settings.address,
        contact_info: settings.contact_info,
        logo_url: settings.logo_url || '',
      });
    }
  }, [settings]);

  // Deny access visually if they aren't super admin or diag manager
  if (profile?.role !== 'super_admin' && profile?.role !== 'diag_manager') {
    return (
      <div className="flex items-center justify-center p-8 text-slate-500">
        You do not have permission to view this page.
      </div>
    );
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please upload an image file.' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Logo must be less than 2MB.' });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('branding')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('branding')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, logo_url: publicUrl }));
      setMessage({ type: 'success', text: 'Logo uploaded! Click Save to apply.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Upload failed: ' + err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    setFormData(prev => ({ ...prev, logo_url: '' }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const { error } = await supabase
        .from('hospital_settings')
        .update({
          name: formData.name,
          address: formData.address,
          contact_info: formData.contact_info,
          logo_url: formData.logo_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1);

      if (error) throw error;
      
      await refreshSettings();
      setMessage({ type: 'success', text: 'Settings updated successfully!' });
      
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update settings.' });
    } finally {
      setLoading(false);
      // Auto dismiss success message
      setTimeout(() => {
        if (message.type !== 'error') setMessage({ type: '', text: '' });
      }, 3000);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-200">
          <Settings className="w-6 h-6 text-slate-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Hospital Configuration</h1>
          <p className="text-sm text-slate-500 mt-1">Manage global details appearing on invoices and dashboards</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 sm:p-8">
          
          {message.text && (
            <div className={`mb-6 p-4 rounded-xl border flex items-start gap-3 ${
              message.type === 'error' 
                ? 'bg-error-50 text-error-700 border-error-200' 
                : 'bg-success-50 text-success-700 border-success-200'
            }`}>
              <span className="text-sm font-medium pt-0.5">{message.text}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-8">
            
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Diagnostic Logo
              </h3>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-6 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-2xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shadow-sm">
                    {formData.logo_url ? (
                      <img src={formData.logo_url} alt="Logo Preview" className="w-full h-full object-contain" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-slate-300" />
                    )}
                  </div>
                  {formData.logo_url && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute -top-2 -right-2 p-1.5 bg-error-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-error-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex-1 space-y-1">
                  <p className="text-sm font-semibold text-slate-800">Upload Logo</p>
                  <p className="text-xs text-slate-500 max-w-xs">Recommend a clean, transparent PNG. Max size 2MB.</p>
                  
                  <div className="pt-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleLogoUpload}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      {uploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      {formData.logo_url ? 'Change Logo' : 'Choose File'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Hospital className="w-4 h-4" />
                Identity Details
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="name">
                  Diagnostic Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="appearance-none block w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                  placeholder="e.g. Smart Hospital & Diagnostics"
                />
                <p className="mt-1.5 text-xs text-slate-500">This will be shown on the top sidebar and login screen.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="address">
                  Physical Address
                </label>
                <textarea
                  id="address"
                  name="address"
                  required
                  rows={2}
                  value={formData.address}
                  onChange={handleChange}
                  className="appearance-none block w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 resize-none"
                  placeholder="Street name, City, Region"
                />
                <p className="mt-1.5 text-xs text-slate-500">Printed on the header of all Patient Invoices.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="contact_info">
                  Contact Information
                </label>
                <textarea
                  id="contact_info"
                  name="contact_info"
                  required
                  rows={2}
                  value={formData.contact_info}
                  onChange={handleChange}
                  className="appearance-none block w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 resize-none"
                  placeholder="Phone: +880... | Email: contact@..."
                />
                <p className="mt-1.5 text-xs text-slate-500">Printed below the address on Invoices.</p>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 py-2.5 px-6 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Configuration
              </button>
            </div>
            
          </form>
        </div>
      </div>
    </div>
  );
}
