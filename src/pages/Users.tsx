import { useEffect, useState } from 'react';
import { Plus, Search, Trash2, Filter, Edit2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import { Button } from '../components/Button';
import { useNotification } from '../components/NotificationProvider';
import { UserModal } from '../components/UserModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { EditProfileModal } from '../components/EditProfileModal';
import { useAuth } from '../hooks/useAuth';

export default function Users() {
  const { profile } = useAuth();
  const { warning, error: showError } = useNotification();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{id: string, name: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [profile]);

  const fetchUsers = async () => {
    setLoading(true);
    let query = supabase.from('profiles').select('*').order('created_at', { ascending: false });
    
    // Diagnostic managers shouldn't see Super Admins based on requirements
    if (profile?.role === 'diag_manager') {
      query = query.neq('role', 'super_admin');
    }

    const { data, error } = await query;
    if (!error && data) {
      setUsers(data as Profile[]);
    }
    setLoading(false);
  };

  const handleUserCreated = () => {
    setIsModalOpen(false);
    fetchUsers(); // Refresh list
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (profile?.id === id) {
      warning('Cant Delete Self', "You cannot delete your own account.");
      return;
    }
    setUserToDelete({ id, name });
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    
    setIsDeleting(true);
    const { error } = await supabase.from('profiles').delete().eq('id', userToDelete.id);
    
    if (error) {
      showError('Delete Failed', `Error deleting user: ${error.message}`);
    } else {
      await fetchUsers();
    }
    
    setIsDeleting(false);
    setUserToDelete(null);
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.full_name.toLowerCase().includes(search.toLowerCase()) || u.role.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button 
          onClick={() => setIsModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
          className="shadow-lg shadow-primary-500/30"
        >
          Add New User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-40 pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-slate-50 focus:bg-white transition-colors appearance-none capitalize"
              >
                <option value="all">All Roles</option>
                {profile?.role !== 'diag_manager' && <option value="super_admin">Super Admin</option>}
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
                placeholder="Search users..." 
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
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">User (ID)</th>
                  <th className="px-6 py-4 font-semibold">Contact Info</th>
                  <th className="px-6 py-4 font-semibold">Role</th>
                  <th className="px-6 py-4 font-semibold">Alerts</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Created Date</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      Loading users...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {user.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{user.full_name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{user.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 border-b border-slate-100">
                        <div className="text-sm">
                          <p className="text-slate-900 font-medium">{user.phone || 'No Phone'}</p>
                          <p className="text-xs text-slate-500">{user.email || 'No Email'}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 border-b border-slate-100">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary-50 text-secondary-700 capitalize border border-secondary-200">
                          {user.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 border-b border-slate-100">
                        <div className="flex flex-col gap-1">
                          {user.notify_new_visits && <span className="text-[10px] uppercase font-bold text-primary-600 tracking-wider">Visits</span>}
                          {user.notify_new_tests && <span className="text-[10px] uppercase font-bold text-secondary-600 tracking-wider">Tests</span>}
                          {!user.notify_new_visits && !user.notify_new_tests && <span className="text-slate-400 text-xs">-</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 border-b border-slate-100">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          user.status === 'active' 
                            ? 'bg-success-50 text-success-700 border-success-200' 
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${user.status === 'active' ? 'bg-success-500' : 'bg-slate-400'}`}></span>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 border-b border-slate-100 text-sm text-slate-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 border-b border-slate-100 text-right">
                        <div className="flex justify-end items-center gap-1">
                          <button
                            onClick={() => setEditUserId(user.id)}
                            className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit User"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {profile?.id !== user.id && (
                            <button
                              onClick={() => handleDeleteUser(user.id, user.full_name)}
                              className="p-2 text-slate-400 hover:text-error-600 hover:bg-error-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {isModalOpen && (
        <UserModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={handleUserCreated}
          title="Add New User"
        />
      )}

      <EditProfileModal
        isOpen={editUserId !== null}
        onClose={() => setEditUserId(null)}
        onSuccess={() => {
          setEditUserId(null);
          fetchUsers();
        }}
        userId={editUserId!}
      />

      <ConfirmModal
        isOpen={userToDelete !== null}
        onClose={() => setUserToDelete(null)}
        onConfirm={confirmDeleteUser}
        title="Delete User"
        message={`Are you sure you want to delete the user "${userToDelete?.name}"?\n\nThis will also remove any notification preferences or doctor profile data tied to them. Their past visits and bills will remain intact but will be disassociated from their account.`}
        confirmText="Delete User"
        cancelText="Cancel"
        type="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
