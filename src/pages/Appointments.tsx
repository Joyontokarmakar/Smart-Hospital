import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, UserPlus, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import { Button } from '../components/Button';

export default function Appointments() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const patientIdParams = searchParams.get('patient');
  
  const [loading, setLoading] = useState(true);
  
  // Data State
  const [visits, setVisits] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  
  // Form State (for Receptionist)
  const [selectedPatient, setSelectedPatient] = useState(patientIdParams || '');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Doctor Filters
  const [filter, setFilter] = useState<'today' | 'weekly' | 'monthly' | 'all'>('today');

  useEffect(() => {
    if (profile?.role === 'receptionist') {
      fetchDoctorsAndPatients();
      fetchVisitsForReceptionist();
    } else if (profile?.role === 'doctor') {
      fetchVisitsForDoctor();
      setupRealtimeSubscription();
    }
  }, [profile, filter]);

  // Realtime subscription for doctors
  const setupRealtimeSubscription = () => {
    if (!profile || profile.role !== 'doctor') return;

    const channel = supabase.channel('custom-all-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'visits', filter: `doctor_id=eq.${profile.id}` },
        () => {
          // Notify doctor and refresh
          fetchVisitsForDoctor();
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('New Patient Assigned', { body: 'Check your queue list.' });
          } else {
            alert('New Patient Assigned to your queue!');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  // Fetching Logic
  const fetchDoctorsAndPatients = async () => {
    const { data: dData } = await supabase.from('profiles').select('id, full_name, doctors_info(specialization)').eq('role', 'doctor');
    const { data: pData } = await supabase.from('patients').select('id, name, phone');
    if (dData) setDoctors(dData);
    if (pData) setPatients(pData);
  };

  const fetchVisitsForReceptionist = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('visits')
      .select('*, patients(name, phone), profiles!doctor_id(full_name)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setVisits(data);
    setLoading(false);
  };

  const fetchVisitsForDoctor = async () => {
    if (!profile) return;
    setLoading(true);
    let query = supabase
      .from('visits')
      .select('*, patients(name, phone, age, gender)')
      .eq('doctor_id', profile.id)
      .order('created_at', { ascending: false });

    // Apply time filter
    const now = new Date();
    if (filter === 'today') {
      const today = now.toISOString().split('T')[0];
      query = query.eq('visit_date', today);
    } else if (filter === 'weekly') {
      const lastWeek = new Date(now.setDate(now.getDate() - 7)).toISOString();
      query = query.gte('created_at', lastWeek);
    } else if (filter === 'monthly') {
      const lastMonth = new Date(now.setMonth(now.getMonth() - 1)).toISOString();
      query = query.gte('created_at', lastMonth);
    }

    const { data } = await query;
    if (data) setVisits(data);
    setLoading(false);
  };

  const handleCreateVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !selectedDoctor) return alert('Select patient and doctor');
    setSubmitting(true);

    const { error } = await supabase.from('visits').insert({
      patient_id: selectedPatient,
      doctor_id: selectedDoctor,
      receptionist_id: profile?.id,
      status: 'queued',
      visit_date: new Date().toISOString().split('T')[0]
    });

    setSubmitting(false);
    if (error) {
      alert(error.message);
    } else {
      alert('Doctor assigned successfully!');
      setSelectedPatient('');
      setSelectedDoctor('');
      fetchVisitsForReceptionist();
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('visits').update({ status: newStatus }).eq('id', id);
    if (!error) {
      if (profile?.role === 'doctor') fetchVisitsForDoctor();
      else fetchVisitsForReceptionist();
    }
  };

  // Request notification permission for doctors on load
  useEffect(() => {
    if (profile?.role === 'doctor' && 'Notification' in window) {
      Notification.requestPermission();
    }
  }, [profile]);

  // -------- RECEPTIONIST VIEW --------
  if (profile?.role === 'receptionist') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Appointments</h1>
          <p className="text-slate-500 text-sm mt-1">Assign doctors to patients</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Assign Doctor</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateVisit} className="flex flex-col md:flex-row gap-4 items-end">
              <div className="w-full">
                <label className="block text-sm font-medium text-slate-700 mb-1">Patient</label>
                <select
                  value={selectedPatient}
                  onChange={(e) => setSelectedPatient(e.target.value)}
                  className="w-full border-slate-200 rounded-lg focus:ring-primary-500 py-2.5 px-3 border outline-none bg-slate-50"
                  required
                >
                  <option value="" disabled>Select Patient</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.name} ({p.phone})</option>)}
                </select>
              </div>
              <div className="w-full">
                <label className="block text-sm font-medium text-slate-700 mb-1">Doctor</label>
                <select
                  value={selectedDoctor}
                  onChange={(e) => setSelectedDoctor(e.target.value)}
                  className="w-full border-slate-200 rounded-lg focus:ring-primary-500 py-2.5 px-3 border outline-none bg-slate-50"
                  required
                >
                  <option value="" disabled>Select Doctor</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>
                      Dr. {d.full_name} {d.doctors_info?.[0]?.specialization ? `(${d.doctors_info[0].specialization})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" isLoading={submitting} leftIcon={<UserPlus className="w-4 h-4" />}>
                Assign
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Assignments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Patient</th>
                  <th className="px-6 py-4 font-semibold">Assigned Doctor</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visits.map(v => (
                  <tr key={v.id}>
                    <td className="px-6 py-4 text-sm">{new Date(v.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 font-medium">{v.patients?.name}</td>
                    <td className="px-6 py-4 text-slate-600">Dr. {v.profiles?.full_name}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium 
                        ${v.status === 'queued' ? 'bg-warning-50 text-warning-700' : 
                          v.status === 'completed' ? 'bg-success-50 text-success-700' : 'bg-slate-100 text-slate-700'}`}>
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    );
  }

  // -------- DOCTOR VIEW --------
  if (profile?.role === 'doctor') {
    const queueList = visits.filter(v => v.status === 'queued' || v.status === 'in_progress');
    const historyList = visits;

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Doctor Dashboard</h1>
            <p className="text-slate-500 text-sm mt-1">Manage your patient queue and history.</p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            {(['today', 'weekly', 'monthly', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                  filter === f ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card className="h-full border-primary-100 shadow-lg shadow-primary-500/5">
              <CardHeader className="bg-primary-50 border-primary-100">
                <CardTitle className="flex items-center gap-2 text-primary-900">
                  <Clock className="w-5 h-5" />
                  Live Queue ({queueList.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {queueList.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm">No patients in queue.</div>
                  ) : (
                    queueList.map(v => (
                      <div key={v.id} className="p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-bold text-slate-900">{v.patients?.name}</p>
                            <p className="text-xs text-slate-500">
                              {v.patients?.age ? `${v.patients.age}y` : ''} {v.patients?.gender ? `, ${v.patients.gender}` : ''}
                            </p>
                          </div>
                          <span className="text-xs font-medium bg-warning-100 text-warning-800 px-2 py-0.5 rounded">
                            {v.status}
                          </span>
                        </div>
                        <div className="flex gap-2 mt-4">
                          {v.status === 'queued' && (
                            <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => handleUpdateStatus(v.id, 'in_progress')}>
                              Start Visit
                            </Button>
                          )}
                          {v.status === 'in_progress' && (
                            <Button size="sm" className="w-full text-xs bg-success-600 hover:bg-success-700" onClick={() => handleUpdateStatus(v.id, 'completed')} leftIcon={<CheckCircle className="w-3.5 h-3.5" />}>
                              Complete
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-slate-500" />
                  Patient History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 text-xs uppercase tracking-wider">
                      <th className="px-6 py-4 font-semibold">Date</th>
                      <th className="px-6 py-4 font-semibold">Patient Name</th>
                      <th className="px-6 py-4 font-semibold">Phone</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr><td colSpan={4} className="p-6 text-center text-slate-500">Loading...</td></tr>
                    ) : historyList.length === 0 ? (
                      <tr><td colSpan={4} className="p-6 text-center text-slate-500">No visits found.</td></tr>
                    ) : (
                      historyList.map(v => (
                        <tr key={v.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4 text-sm text-slate-600">{new Date(v.created_at).toLocaleString()}</td>
                          <td className="px-6 py-4 font-medium text-slate-900">{v.patients?.name}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{v.patients?.phone}</td>
                          <td className="px-6 py-4">
                            <span className="capitalize text-xs font-medium px-2 py-1 bg-slate-100 rounded text-slate-600 border border-slate-200">
                              {v.status.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Fallback for other roles who somehow get here
  return <div className="p-8 text-center">You do not have access to this module.</div>;
}
