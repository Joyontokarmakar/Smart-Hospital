import { useEffect, useState } from 'react';
import { Clock, Activity, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';

type ActivityTab = 'Visits' | 'Tests';

export default function ActivityLog() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<ActivityTab>('Visits');
  const [visits, setVisits] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const canViewVisits = profile?.role === 'super_admin' || profile?.notify_new_visits || profile?.notify_own_visits_only;
  const canViewTests = profile?.role === 'super_admin' || profile?.notify_new_tests || profile?.notify_own_tests_only;

  useEffect(() => {
    if (profile) {
      // Set default tab based on permissions
      if (!canViewVisits && canViewTests) setActiveTab('Tests');
      fetchActivity();
    }
  }, [profile]);

  const fetchActivity = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    try {
      // Fetch Visits if permitted
      if (canViewVisits) {
        let query = supabase
          .from('visits')
          .select(`
            *,
            patient:patients(name, phone),
            doctor:profiles!visits_doctor_id_fkey(full_name)
          `)
          .eq('visit_date', today)
          .order('created_at', { ascending: false });

        // Apply "Own Only" restriction for doctors who don't have global visit access
        if (profile?.role === 'doctor' && profile?.notify_own_visits_only && !profile?.notify_new_visits) {
          query = query.eq('doctor_id', profile.id);
        }

        const { data: vData } = await query;
        if (vData) setVisits(vData);
      }

      // Fetch Bills/Tests if permitted
      if (canViewTests) {
        let query = supabase
          .from('bills')
          .select(`
            *,
            patient:patients(name, phone),
            items:bill_items(*),
            receptionist:profiles!receptionist_id(full_name)
          `)
          .gte('created_at', todayStart.toISOString())
          .order('created_at', { ascending: false });

        // Apply "Own Only" restriction for doctors
        if (profile?.role === 'doctor' && profile?.notify_own_tests_only && !profile?.notify_new_tests) {
          // This is a bit more complex. Usually we show tests for patients assigned to them today.
          const { data: myPatients } = await supabase
            .from('visits')
            .select('patient_id')
            .eq('doctor_id', profile.id)
            .eq('visit_date', today);
          
          const patientIds = myPatients?.map(p => p.patient_id) || [];
          if (patientIds.length > 0) {
            query = query.in('patient_id', patientIds);
          } else {
            // No patients today, so no tests visible
            setBills([]);
            setLoading(false);
            return;
          }
        }

        const { data: bData } = await query;
        if (bData) setBills(bData);
      }
    } catch (err) {
      console.error('Error fetching activity log:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredVisits = visits.filter(v => 
    v.patient?.name?.toLowerCase().includes(search.toLowerCase()) ||
    v.doctor?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    v.patient?.phone?.includes(search)
  );

  const filteredBills = bills.filter(b => 
    b.patient?.name?.toLowerCase().includes(search.toLowerCase()) ||
    b.items?.some((i: any) => i.test_name.toLowerCase().includes(search.toLowerCase())) ||
    b.patient?.phone?.includes(search)
  );

  if (!profile) return null;

  return (
    <div className="space-y-6">
      <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
          {canViewVisits && (
            <button 
              onClick={() => setActiveTab('Visits')}
              className={`flex-1 sm:flex-none px-6 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'Visits' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Visits
            </button>
          )}
          {canViewTests && (
            <button 
              onClick={() => setActiveTab('Tests')}
              className={`flex-1 sm:flex-none px-6 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'Tests' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Tests
            </button>
          )}
        </div>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <CardTitle>{activeTab === 'Visits' ? 'Today Arrivals' : 'Diagnostic Activity'}</CardTitle>
          </div>
          
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder={`Search ${activeTab.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-slate-50 focus:bg-white transition-colors"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {activeTab === 'Visits' ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 text-[10px] uppercase font-bold tracking-widest">
                    <th className="px-6 py-4">Time</th>
                    <th className="px-6 py-4">Patient</th>
                    <th className="px-6 py-4">Assigned Doctor</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400">Loading...</td></tr>
                  ) : filteredVisits.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400">No visits logged today matching your criteria.</td></tr>
                  ) : filteredVisits.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-500 font-mono">
                        {new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center font-bold text-xs uppercase">
                            {v.patient?.name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">{v.patient?.name}</p>
                            <p className="text-[10px] text-slate-400">{v.patient?.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700 text-sm">{v.doctor?.full_name}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-tight ${
                          v.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                          v.status === 'cancelled' ? 'bg-rose-50 text-rose-600' :
                          v.status === 'in_progress' ? 'bg-amber-50 text-amber-600' :
                          'bg-primary-50 text-primary-600'
                        }`}>
                          {v.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 text-[10px] uppercase font-bold tracking-widest">
                    <th className="px-6 py-4">Time</th>
                    <th className="px-6 py-4">Patient</th>
                    <th className="px-6 py-4">Tests</th>
                    <th className="px-6 py-4 text-right">Subtotal</th>
                    <th className="px-6 py-4 text-right">Discount</th>
                    <th className="px-6 py-4 text-right">Total</th>
                    <th className="px-6 py-4 text-right">Paid</th>
                    <th className="px-6 py-4 text-right">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">Loading...</td></tr>
                  ) : filteredBills.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">No tests billed today matching your criteria.</td></tr>
                  ) : filteredBills.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4 text-sm text-slate-500 font-mono text-center">
                        {new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-secondary-50 text-secondary-600 flex items-center justify-center font-bold text-xs uppercase">
                            {b.patient?.name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">{b.patient?.name}</p>
                            <p className="text-[10px] text-slate-400">{b.patient?.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {b.items?.map((item: any) => (
                            <span key={item.id} className="px-2 py-0.5 bg-white border border-slate-200 text-slate-600 text-[10px] rounded-md font-medium">
                              {item.test_name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-bold text-slate-600 font-mono">৳{Number(b.subtotal || 0).toFixed(2)}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-[11px] font-bold text-secondary-600 font-mono">৳{Number(b.total_discount || 0).toFixed(2)}</span>
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                           <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">By:</span>
                           <span className="text-[9px] font-black text-slate-500">{b.receptionist?.full_name?.split(' ')[0] || 'System'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-black text-slate-900 font-mono">৳{b.total_amount.toFixed(2)}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-bold text-emerald-600 font-mono">৳{Number(b.amount_paid || 0).toFixed(2)}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end">
                           <span className={`text-sm font-bold font-mono ${b.amount_due > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                              ৳{Number(b.amount_due || 0).toFixed(2)}
                           </span>
                           <span className={`text-[9px] font-bold uppercase tracking-tight ${b.status === 'paid' ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {b.status}
                           </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>

      {!canViewVisits && !canViewTests && (
        <div className="p-12 text-center text-slate-500 space-y-4">
           <Activity className="w-12 h-12 mx-auto opacity-20" />
           <p>You do not have permission to view today's activity log.</p>
           <p className="text-sm">Please contact the administrator to enable notification permissions.</p>
        </div>
      )}
    </div>
  );
}
