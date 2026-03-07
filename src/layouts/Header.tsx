import { Bell, Search, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export function Header() {
  const { profile, signOut } = useAuth();

  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-20">
      
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
        
        {/* Notifications (Important for Doctors) */}
        <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
          <Bell className="w-5 h-5" />
          {profile?.role === 'doctor' && (
            <span className="absolute top-1.5 right-1.5 block w-2 h-2 rounded-full bg-error-500 ring-2 ring-white" />
          )}
        </button>

        <div className="w-px h-6 bg-slate-200 hidden sm:block"></div>

        {/* User Actions */}
        <button 
          onClick={signOut}
          className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-error-600 transition-colors py-2 group"
        >
          <span className="hidden sm:block">Sign out</span>
          <LogOut className="w-4 h-4 group-hover:rotate-12 transition-transform" />
        </button>
      </div>
    </header>
  );
}
