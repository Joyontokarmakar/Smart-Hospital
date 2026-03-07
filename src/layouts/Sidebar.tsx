import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Users, 
  Settings, 
  Activity, 
  FileText, 
  Clock, 
  Calendar,
  LayoutDashboard,
  Menu,
  X,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  roles: string[];
}

const navItems: NavItem[] = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['super_admin', 'diag_manager', 'receptionist', 'account_manager', 'doctor'] },
  { name: 'Users', path: '/users', icon: Users, roles: ['super_admin', 'diag_manager'] },
  { name: 'Tests', path: '/tests', icon: Activity, roles: ['super_admin', 'diag_manager'] },
  { name: 'Patients', path: '/patients', icon: Users, roles: ['receptionist', 'doctor'] },
  { name: 'Billing', path: '/billing', icon: FileText, roles: ['receptionist'] },
  { name: 'Appointments', path: '/appointments', icon: Calendar, roles: ['receptionist', 'doctor'] },
  { name: 'Reports', path: '/reports', icon: FileText, roles: ['super_admin', 'diag_manager', 'account_manager'] },
  { name: 'Logs', path: '/logs', icon: Clock, roles: ['super_admin', 'diag_manager'] },
  { name: 'Notifications', path: '/notification-permissions', icon: ShieldCheck, roles: ['super_admin'] },
  { name: 'Settings', path: '/settings', icon: Settings, roles: ['super_admin', 'diag_manager'] },
];

export function Sidebar() {
  const { profile } = useAuth();
  const { settings } = useSettings();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!profile) return null;

  const allowedItems = navItems.filter(item => item.roles.includes(profile.role));

  const toggleSidebar = () => setCollapsed(!collapsed);
  const toggleMobileMenu = () => setMobileOpen(!mobileOpen);

  return (
    <>
      {/* Mobile Toggle Button */}
      <button 
        onClick={toggleMobileMenu}
        className="lg:hidden fixed bottom-4 right-4 z-50 p-3 bg-primary-600 text-white rounded-full shadow-lg cursor-pointer"
      >
        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Content */}
      <aside 
        className={`fixed inset-y-0 left-0 z-40 bg-white border-r border-slate-200 transition-all duration-300 ease-in-out flex flex-col shadow-xl lg:shadow-none lg:relative lg:flex-shrink-0
          ${collapsed ? 'w-20' : 'w-64'} 
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo Area */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
              {settings?.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <Stethoscope size={24} />
              )}
            </div>
            {!collapsed && (
              <span className="font-bold text-slate-800 truncate select-none transition-opacity duration-300">
                {settings?.name || 'Smart Hospital'}
              </span>
            )}
          </div>
          <button 
            onClick={toggleSidebar}
            className="hidden lg:flex p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
          {allowedItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }: { isActive: boolean }) => `
                flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative cursor-pointer
                ${isActive 
                  ? 'bg-primary-50 text-primary-700 font-medium' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }
              `}
              title={collapsed ? item.name : undefined}
            >
              {({ isActive }) => (
                <>
                  <item.icon size={20} className={`
                      shrink-0 transition-colors
                      ${isActive ? 'text-primary-600' : 'text-slate-400 group-hover:text-slate-600'}
                    `} 
                  />
                  {!collapsed && (
                    <span className="truncate">{item.name}</span>
                  )}

                  {/* Tooltip for collapsed state */}
                  {collapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                      {item.name}
                    </div>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>

        {/* User Profile Summary */}
        <div className="p-4 border-t border-slate-100 shrink-0">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary-500 to-secondary-500 flex items-center justify-center text-white font-bold shrink-0 shadow-sm border-2 border-white">
              {profile.full_name.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {profile.full_name}
                </p>
                <p className="text-xs text-slate-500 truncate capitalize">
                  {profile.role.replace('_', ' ')}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
