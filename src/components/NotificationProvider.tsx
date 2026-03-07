import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Bell, X, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'visit' | 'test';

interface Toast {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
}

interface NotificationContextType {
  showNotification: (title: string, message: string, type?: NotificationType) => void;
  success: (title: string, message: string) => void;
  error: (title: string, message: string) => void;
  warning: (title: string, message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((title: string, message: string, type: NotificationType = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type }]);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  }, [removeToast]);

  const success = (title: string, message: string) => addToast(title, message, 'success');
  const error = (title: string, message: string) => addToast(title, message, 'error');
  const warning = (title: string, message: string) => addToast(title, message, 'warning');

  useEffect(() => {
    if (!profile) return;

    let visitSubscription: any = null;
    let testSubscription: any = null;

    if (profile.notify_new_visits) {
      visitSubscription = supabase
        .channel('public:visits')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'visits' },
          () => {
            addToast("New Visit Booked", "A new appointment has been scheduled.", 'visit');
          }
        )
        .subscribe();
    }

    if (profile.notify_new_tests) {
      testSubscription = supabase
        .channel('public:bills')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'bills' },
          () => {
            addToast("New Test Billed", "A new diagnostic test bill was created.", 'test');
          }
        )
        .subscribe();
    }

    return () => {
      if (visitSubscription) supabase.removeChannel(visitSubscription);
      if (testSubscription) supabase.removeChannel(testSubscription);
    };
  }, [profile, addToast]);

  return (
    <NotificationContext.Provider value={{ showNotification: addToast, success, error, warning }}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <div 
            key={toast.id}
            className="pointer-events-auto bg-white border border-slate-200 shadow-2xl rounded-2xl p-4 flex gap-3 max-w-sm w-[350px] animate-fade-in-up items-start border-l-4"
            style={{ 
              borderLeftColor: 
                toast.type === 'success' ? '#10b981' : 
                toast.type === 'error' ? '#ef4444' : 
                toast.type === 'warning' ? '#f59e0b' : 
                toast.type === 'visit' ? '#3b82f6' : 
                toast.type === 'test' ? '#8b5cf6' : '#64748b'
            }}
          >
            <div className={`p-2 rounded-xl shrink-0 ${
              toast.type === 'success' ? 'bg-success-50 text-success-600' :
              toast.type === 'error' ? 'bg-error-50 text-error-600' :
              toast.type === 'warning' ? 'bg-warning-50 text-warning-600' :
              toast.type === 'visit' ? 'bg-blue-50 text-blue-600' :
              toast.type === 'test' ? 'bg-purple-50 text-purple-600' :
              'bg-slate-50 text-slate-600'
            }`}>
              {toast.type === 'success' && <CheckCircle2 size={20} />}
              {toast.type === 'error' && <AlertCircle size={20} />}
              {toast.type === 'warning' && <AlertTriangle size={20} />}
              {(toast.type === 'info' || toast.type === 'visit' || toast.type === 'test') && <Bell size={20} />}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-slate-800 tracking-tight">{toast.title}</h4>
              <p className="text-sm text-slate-500 mt-1 leading-snug">{toast.message}</p>
            </div>
            <button 
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 transition-colors shrink-0 p-1 hover:bg-slate-50 rounded-lg cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
