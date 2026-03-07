import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { 
  Users, 
  Activity, 
  CreditCard, 
  Calendar, 
  TrendingUp,
  Loader2,
  Clock,
  ArrowRight,
  Stethoscope,
  HeartPulse,
  Banknote,
  AlertOctagon,
  Trophy
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { profile } = useAuth();
  
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDoctors: 0,
    totalPatients: 0,
    totalTests: 0,
    totalIncome: 0,
    totalDue: 0,
    todayVisits: 0,
    todayBills: 0,
    todayRevenue: 0,
    totalDoctorPatients: 0,
    highestPatientsPerDate: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchStats();
    }
  }, [profile]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const todayDate = new Date();
      // YYYY-MM-DD local format
      const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth()+1).padStart(2,'0')}-${String(todayDate.getDate()).padStart(2,'0')}`;
      
      const promises: any[] = [];

      if (['super_admin', 'diag_manager'].includes(profile?.role || '')) {
        promises.push(
          supabase.from('profiles').select('*', { count: 'exact', head: true }).then(r => ({ totalUsers: r.count || 0 })),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'doctor').then(r => ({ totalDoctors: r.count || 0 })),
          supabase.from('patients').select('*', { count: 'exact', head: true }).then(r => ({ totalPatients: r.count || 0 })),
          supabase.from('tests').select('*', { count: 'exact', head: true }).then(r => ({ totalTests: r.count || 0 })),
          supabase.from('bills').select('amount_paid, amount_due').then(res => {
            const bills = res.data || [];
            return {
              totalIncome: bills.reduce((sum, b) => sum + Number(b.amount_paid), 0),
              totalDue: bills.reduce((sum, b) => sum + Number(b.amount_due), 0)
            };
          })
        );
      }

      promises.push(
        supabase.from('visits').select('*', { count: 'exact', head: true }).eq('visit_date', todayStr).then(r => ({ todayVisits: r.count || 0 }))
      );

      if (['super_admin', 'diag_manager', 'receptionist', 'account_manager'].includes(profile?.role || '')) {
         promises.push(
           supabase.from('bills').select('total_amount').gte('created_at', `${todayStr}T00:00:00Z`).then(res => {
              const bills = res.data || [];
              return {
                todayBills: bills.length,
                todayRevenue: bills.reduce((sum, b) => sum + Number(b.total_amount), 0)
              };
           })
         );
      }

      if (profile?.role === 'doctor') {
        promises.push(
          supabase.from('visits').select('patient_id, visit_date').eq('doctor_id', profile.id).then(res => {
            const visits = res.data || [];
            const uniquePatients = new Set(visits.map(v => v.patient_id)).size;
            
            const dateCounts: Record<string, number> = {};
            visits.forEach(v => {
              dateCounts[v.visit_date] = (dateCounts[v.visit_date] || 0) + 1;
            });
            const maxPatients = Object.keys(dateCounts).length > 0 ? Math.max(...Object.values(dateCounts)) : 0;

            return { totalDoctorPatients: uniquePatients, highestPatientsPerDate: maxPatients };
          })
        );
      }

      const results = await Promise.all(promises);
      let newStats = { ...stats };
      results.forEach(res => {
        newStats = { ...newStats, ...res };
      });
      setStats(newStats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Doctors',
      value: stats.totalDoctors,
      icon: Stethoscope,
      color: 'bg-indigo-500',
      lightColor: 'bg-indigo-50',
      textColor: 'text-indigo-600',
      roles: ['super_admin', 'diag_manager']
    },
    {
      title: 'Total Patients',
      value: stats.totalPatients,
      icon: HeartPulse,
      color: 'bg-rose-500',
      lightColor: 'bg-rose-50',
      textColor: 'text-rose-600',
      roles: ['super_admin', 'diag_manager']
    },
    {
      title: 'Available Tests',
      value: stats.totalTests,
      icon: Activity,
      color: 'bg-purple-500',
      lightColor: 'bg-purple-50',
      textColor: 'text-purple-600',
      roles: ['super_admin', 'diag_manager']
    },
    {
      title: 'Total Income',
      value: `৳${stats.totalIncome.toFixed(2)}`,
      icon: Banknote,
      color: 'bg-emerald-500',
      lightColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
      roles: ['super_admin', 'diag_manager']
    },
    {
      title: 'Total Due',
      value: `৳${stats.totalDue.toFixed(2)}`,
      icon: AlertOctagon,
      color: 'bg-red-500',
      lightColor: 'bg-red-50',
      textColor: 'text-red-600',
      roles: ['super_admin', 'diag_manager']
    },
    // Doctor specific cards
    {
      title: 'My Total Patients',
      value: stats.totalDoctorPatients,
      icon: Users,
      color: 'bg-blue-500',
      lightColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      roles: ['doctor']
    },
    {
      title: 'Highest Patients/Day',
      value: stats.highestPatientsPerDate,
      icon: Trophy,
      color: 'bg-amber-500',
      lightColor: 'bg-amber-50',
      textColor: 'text-amber-600',
      roles: ['doctor']
    },
    // General Cards
    {
      title: "Today's Visits",
      value: stats.todayVisits,
      icon: Calendar,
      color: 'bg-emerald-500',
      lightColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
      roles: ['super_admin', 'diag_manager', 'receptionist', 'doctor']
    },
    {
      title: "Today's Bills",
      value: stats.todayBills,
      icon: CreditCard,
      color: 'bg-amber-500',
      lightColor: 'bg-amber-50',
      textColor: 'text-amber-600',
      roles: ['super_admin', 'diag_manager', 'receptionist', 'account_manager']
    },
    {
      title: "Today's Revenue",
      value: `৳${stats.todayRevenue.toFixed(2)}`,
      icon: TrendingUp,
      color: 'bg-blue-500',
      lightColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      roles: ['super_admin', 'diag_manager', 'account_manager']
    }
  ];

  const visibleCards = statCards.filter(card => card.roles.includes(profile?.role || ''));

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-60"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-secondary-50 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4 opacity-60"></div>
        
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
            Welcome back, <span className="text-primary-600">{profile?.full_name}</span>
          </h1>
          <p className="text-slate-500 mt-2 text-lg">
            Here's what's happening at the hospital today.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-sm font-medium capitalize border border-slate-200">
              <Clock className="w-4 h-4" />
              {profile?.role.replace('_', ' ')} Access
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="min-h-[200px] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {visibleCards.map((card, idx) => (
            <div 
              key={idx} 
              className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.lightColor} ${card.textColor} group-hover:scale-110 transition-transform duration-300`}>
                  <card.icon className="w-6 h-6" />
                </div>
              </div>
              <div>
                <h3 className="text-slate-500 text-sm font-medium tracking-wide mb-1">{card.title}</h3>
                <p className="text-3xl font-bold text-slate-800 tracking-tight flex items-baseline gap-2">
                  {card.value}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions (Depends on role) */}
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
        <h2 className="text-xl font-bold text-slate-800 mb-6 tracking-tight">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          
          {['super_admin', 'diag_manager', 'receptionist'].includes(profile?.role || '') && (
            <Link to="/patients" className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-primary-200 hover:bg-primary-50 transition-colors group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-primary-600 border border-slate-100 group-hover:border-primary-200">
                  <Users className="w-5 h-5" />
                </div>
                <div className="font-medium text-slate-700 group-hover:text-primary-700">Add New Patient</div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-primary-600 transition-transform group-hover:translate-x-1" />
            </Link>
          )}

          {['super_admin', 'diag_manager'].includes(profile?.role || '') && (
            <Link to="/tests" className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-purple-200 hover:bg-purple-50 transition-colors group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-purple-600 border border-slate-100 group-hover:border-purple-200">
                  <Activity className="w-5 h-5" />
                </div>
                <div className="font-medium text-slate-700 group-hover:text-purple-700">Manage Test Pricing</div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-purple-600 transition-transform group-hover:translate-x-1" />
            </Link>
          )}

          {['receptionist', 'doctor'].includes(profile?.role || '') && (
            <Link to="/appointments" className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50 transition-colors group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-emerald-600 border border-slate-100 group-hover:border-emerald-200">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="font-medium text-slate-700 group-hover:text-emerald-700">View Appointments</div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 transition-transform group-hover:translate-x-1" />
            </Link>
          )}

        </div>
      </div>
    </div>
  );
}
