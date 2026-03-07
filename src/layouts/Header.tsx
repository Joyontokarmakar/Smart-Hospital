import { useEffect, useState, useRef } from 'react';
import { Bell, Search, LogOut, Check, CheckCircle2, AlertCircle, FileText, User, Activity } from 'lucide-react';
import { EditProfileModal } from '../components/EditProfileModal';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { supabase } from '../lib/supabase';
import type { Notification } from '../types';
import { formatDistanceToNow } from 'date-fns';

export function Header() {
  const { profile, signOut } = useAuth();
  const { settings } = useSettings();
  
  // Notification State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch initial notifications
  useEffect(() => {
    if (!profile?.id) return;

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (!error && data) {
        setNotifications(data);
      }
    };

    fetchNotifications();
  }, [profile?.id]);

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!profile?.id) return;

    const subscription = supabase
      .channel(`header-notifications-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          setNotifications((prev) => 
            prev.map(n => n.id === payload.new.id ? payload.new as Notification : n)
          );
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [profile?.id]);

  // Close panel on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsPanelOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsRead = async (id: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
  };

  const markAllAsRead = async () => {
    if (unreadCount === 0 || !profile?.id) return;
    
    // Update local state immediately for snappy UI
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', profile.id)
      .eq('is_read', false);
  };

  return (
    <header className="h-16 shrink-0 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-20">
      
      {/* Mobile Logo Logo Area */}
      <div className="flex md:hidden items-center gap-2">
        <div className="w-8 h-8 bg-primary-50 flex items-center justify-center rounded-lg overflow-hidden">
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt="Logo" className="w-full h-full object-contain" />
          ) : (
            <Activity className="w-5 h-5 text-primary-600" />
          )}
        </div>
      </div>
      
      {/* Search Bar Placeholder */}
      <div className="flex-1 max-w-md hidden md:flex">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-full leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent sm:text-sm transition-colors duration-200"
            placeholder="Search..."
          />
        </div>
      </div>

      <div className="flex items-center justify-end w-full md:w-auto gap-4">
        
        {/* Navigation / Notifications Dropdown */}
        <div className="relative" ref={panelRef}>
          <button 
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            className={`relative p-2 rounded-full transition-colors cursor-pointer ${isPanelOpen ? 'bg-primary-50 text-primary-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
          >
            <Bell className="w-5 h-5" />
            
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-error-500 rounded-full ring-2 ring-white transform translate-x-1/4 -translate-y-1/4">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown Panel */}
          {isPanelOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-fade-in-up origin-top-right">
              
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-semibold text-slate-800">Notifications</h3>
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-[400px] overflow-y-auto no-scrollbar">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                      <Bell className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-500 font-medium">No notifications yet</p>
                    <p className="text-xs text-slate-400 mt-1">We'll let you know when something happens</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {notifications.map((notification) => (
                      <div 
                        key={notification.id}
                        onClick={() => {
                          if (!notification.is_read) markAsRead(notification.id);
                        }}
                        className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer flex gap-3 ${
                          !notification.is_read ? 'bg-primary-50/30' : ''
                        }`}
                      >
                        {/* Icon */}
                        <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          notification.type === 'visit' ? 'bg-blue-100 text-blue-600' :
                          notification.type === 'test' ? 'bg-purple-100 text-purple-600' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {notification.type === 'visit' ? <CheckCircle2 className="w-4 h-4" /> :
                           notification.type === 'test' ? <FileText className="w-4 h-4" /> :
                           <AlertCircle className="w-4 h-4" />}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm tracking-tight ${!notification.is_read ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-slate-500 mt-0.5 truncate">
                            {notification.message}
                          </p>
                          <p className="text-xs text-slate-400 mt-1.5 tracking-tight font-medium">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        
                        {/* Unread Indicator */}
                        {!notification.is_read && (
                          <div className="shrink-0 flex items-center">
                            <span className="w-2 h-2 rounded-full bg-primary-500 shadow-sm"></span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-3 border-t border-slate-100 bg-slate-50 text-center">
                <p className="text-xs font-medium text-slate-500 tracking-wide">
                  Showing last {notifications.length} alerts
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-slate-200 hidden sm:block"></div>

        {/* User Actions */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsEditProfileOpen(true)}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-primary-600 transition-colors py-2 group cursor-pointer"
          >
            <span className="hidden sm:block">My Profile</span>
            <User className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
          </button>
          <button 
            onClick={signOut}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-error-600 transition-colors py-2 group cursor-pointer"
          >
            <span className="hidden sm:block">Sign out</span>
            <LogOut className="w-4 h-4 group-hover:rotate-12 transition-transform" />
          </button>
        </div>
      </div>

      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        onSuccess={() => setIsEditProfileOpen(false)}
        userId={profile?.id!}
      />
    </header>
  );
}
