import { useEffect, useState } from 'react';
import { Search, Filter, Loader2, Bell, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../components/NotificationProvider';

export default function NotificationManagement() {
  const { profile } = useAuth();
  const { error: showError } = useNotification();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });
    
    if (!error && data) {
      setUsers(data as Profile[]);
    }
    setLoading(false);
  };

  const togglePermission = async (userId: string, field: keyof Profile, currentValue: boolean) => {
    setUpdating(`${userId}-${field}`);
    const { error } = await supabase
      .from('profiles')
      .update({ [field]: !currentValue })
      .eq('id', userId);

    if (error) {
      showError('Update Failed', `Error updating permission: ${error.message}`);
    } else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, [field]: !currentValue } : u));
    }
    setUpdating(null);
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.full_name.toLowerCase().includes(search.toLowerCase()) || u.role.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (profile?.role !== 'super_admin') {
    return (
      <div className="flex items-center justify-center p-8 text-slate-500">
        You do not have permission to view this page.
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <Card>
        <CardHeader>
          <CardTitle>Staff List</CardTitle>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-40 pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-slate-50 focus:bg-white transition-colors cursor-pointer capitalize"
              >
                <option value="all">All Roles</option>
                <option value="diag_manager">Diag Manager</option>
                <option value="doctor">Doctor</option>
                <option value="receptionist">Receptionist</option>
                <option value="account_manager">Account Manager</option>
              </select>
            </div>
            
            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search staff..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-slate-50 focus:bg-white transition-colors"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 text-[10px] uppercase font-bold tracking-widest">
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4 text-center">Global Visits</th>
                  <th className="px-6 py-4 text-center">Own Visits Only</th>
                  <th className="px-6 py-4 text-center">Global Tests</th>
                  <th className="px-6 py-4 text-center">Own Tests Only</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                        <span>Loading staff permissions...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      No staff found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">
                            {u.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{u.full_name}</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-tight font-bold">{u.role.replace('_', ' ')}</p>
                          </div>
                        </div>
                      </td>
                      
                      {/* Global Visits */}
                      <td className="px-6 py-4 text-center">
                        <PermissionToggle 
                          active={u.notify_new_visits || false} 
                          loading={updating === `${u.id}-notify_new_visits`}
                          onClick={() => togglePermission(u.id, 'notify_new_visits', u.notify_new_visits || false)}
                          disabled={u.notify_own_visits_only}
                        />
                      </td>

                      {/* Own Visits Only (Doctor Specific) */}
                      <td className="px-6 py-4 text-center">
                        {u.role === 'doctor' ? (
                          <PermissionToggle 
                            active={u.notify_own_visits_only || false} 
                            loading={updating === `${u.id}-notify_own_visits_only`}
                            onClick={() => togglePermission(u.id, 'notify_own_visits_only', u.notify_own_visits_only || false)}
                            variant="secondary"
                          />
                        ) : (
                          <span className="text-slate-300 text-xs">-</span>
                        )}
                      </td>

                      {/* Global Tests */}
                      <td className="px-6 py-4 text-center">
                        <PermissionToggle 
                          active={u.notify_new_tests || false} 
                          loading={updating === `${u.id}-notify_new_tests`}
                          onClick={() => togglePermission(u.id, 'notify_new_tests', u.notify_new_tests || false)}
                          disabled={u.notify_own_tests_only}
                        />
                      </td>

                      {/* Own Tests Only */}
                      <td className="px-6 py-4 text-center">
                         {u.role === 'doctor' ? (
                          <PermissionToggle 
                            active={u.notify_own_tests_only || false} 
                            loading={updating === `${u.id}-notify_own_tests_only`}
                            onClick={() => togglePermission(u.id, 'notify_own_tests_only', u.notify_own_tests_only || false)}
                            variant="secondary"
                          />
                        ) : (
                          <span className="text-slate-300 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      <div className="bg-primary-50 border border-primary-100 rounded-2xl p-6 flex gap-4 items-start">
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 border border-primary-100">
          <Bell className="w-5 h-5 text-primary-600" />
        </div>
        <div>
          <h4 className="font-semibold text-primary-900">How it works</h4>
          <p className="text-sm text-primary-700 mt-1 leading-relaxed">
            <strong>Global Alerts:</strong> User is notified about ALL events in the hospital of that type. <br/>
            <strong>Own Only:</strong> Specifically for Doctors. When enabled, they only receive alerts for patients explicitly assigned to them in the visit registry.
          </p>
        </div>
      </div>
    </div>
  );
}

function PermissionToggle({ active, loading, onClick, disabled = false, variant = 'primary' }: { active: boolean, loading: boolean, onClick: () => void, disabled?: boolean, variant?: 'primary' | 'secondary' }) {
  if (loading) return <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-300" />;
  
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-flex items-center justify-center p-2 rounded-xl transition-all group cursor-pointer 
        ${disabled ? 'opacity-30 cursor-not-allowed grayscale' : ''}
        ${active 
          ? variant === 'primary' 
            ? 'bg-primary-50 text-primary-600 shadow-inner' 
            : 'bg-secondary-50 text-secondary-600 shadow-inner'
          : 'bg-slate-50 text-slate-300 hover:bg-slate-100 hover:text-slate-400 border border-transparent hover:border-slate-200'
        }
      `}
    >
      <CheckCircle2 className={`w-5 h-5 transition-transform ${active ? 'scale-110' : 'scale-90 opacity-20 group-hover:opacity-100'}`} />
    </button>
  );
}
