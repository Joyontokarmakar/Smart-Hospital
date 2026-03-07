import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { supabase } from '../lib/supabase';

import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import { Button } from '../components/Button';

export default function Logs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [receptionists, setReceptionists] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedUser, setSelectedUser] = useState('');
  
  // Using generic window.print approach for simplified printing
  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    fetchReceptionists();
  }, []);

  useEffect(() => {
    if (selectedDate || selectedUser) {
      fetchLogs();
    }
  }, [selectedDate, selectedUser]);

  const fetchReceptionists = async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'receptionist');
      
    if (profiles) setReceptionists(profiles);
  };

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase
      .from('receptionist_logs')
      .select(`
        id, login_time, logout_time, date,
        profiles (full_name)
      `)
      .order('login_time', { ascending: false });

    if (selectedDate) {
      query = query.eq('date', selectedDate);
    }
    if (selectedUser) {
      query = query.eq('receptionist_id', selectedUser);
    }

    const { data, error } = await query;
    if (!error && data) {
      setLogs(data);
    }
    setLoading(false);
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return 'Active';
    return new Date(timeString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6 print:space-y-0 print:m-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Receptionist Logs</h1>
          <p className="text-slate-500 text-sm mt-1">View login and logout timings.</p>
        </div>
        <Button 
          onClick={handlePrint}
          leftIcon={<Printer className="w-4 h-4" />}
          variant="secondary"
        >
          Print Report
        </Button>
      </div>

      <Card className="print:border-none print:shadow-none">
        <CardHeader className="print:hidden">
          <CardTitle>Filters</CardTitle>
          <div className="flex gap-4">
            <div className="w-48">
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full text-sm border-slate-200 rounded-lg focus:ring-primary-500 py-2 px-3 border outline-none bg-slate-50"
              >
                <option value="">All Receptionists</option>
                {receptionists.map(r => (
                  <option key={r.id} value={r.id}>{r.full_name}</option>
                ))}
              </select>
            </div>
            <div className="w-40 relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full text-sm border-slate-200 rounded-lg focus:ring-primary-500 py-2 px-3 border outline-none bg-slate-50"
              />
            </div>
          </div>
        </CardHeader>
        
        {/* Printable Area */}
        <CardContent className="p-0 print:p-0">
          <div className="hidden print:block mb-8 text-center pt-8">
            <h2 className="text-2xl font-bold">Smart Hospital and Diagnostic</h2>
            <h3 className="text-xl mt-2 border-b border-black pb-4 inline-block">Receptionist Login/Logout Report</h3>
            <div className="mt-4 flex justify-between text-sm">
              <p><strong>Date:</strong> {selectedDate || 'All Dates'}</p>
              <p><strong>Receptionist:</strong> {selectedUser ? receptionists.find(r => r.id === selectedUser)?.full_name : 'All'}</p>
            </div>
          </div>

          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-left border-collapse print:border print:border-slate-300">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 print:bg-slate-100 print:border-black text-slate-600 print:text-black text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold print:border print:border-slate-300">Date</th>
                  <th className="px-6 py-4 font-semibold print:border print:border-slate-300">Receptionist Name</th>
                  <th className="px-6 py-4 font-semibold print:border print:border-slate-300">Login Time</th>
                  <th className="px-6 py-4 font-semibold print:border print:border-slate-300">Logout Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 print:divide-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500 print:hidden">
                      Loading logs...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500 print:border print:border-slate-300">
                      No logs found for selected criteria.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors print:hover:bg-transparent">
                      <td className="px-6 py-4 border-b border-slate-100 print:border-slate-300 print:border text-sm text-slate-600 print:text-black">
                        {new Date(log.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 border-b border-slate-100 print:border-slate-300 print:border">
                        <p className="font-medium text-slate-900 print:text-black">
                          {log.profiles?.full_name || 'Unknown'}
                        </p>
                      </td>
                      <td className="px-6 py-4 border-b border-slate-100 print:border-slate-300 print:border text-sm text-slate-600 print:text-black">
                        {formatTime(log.login_time)}
                      </td>
                      <td className="px-6 py-4 border-b border-slate-100 print:border-slate-300 print:border text-sm text-slate-600 print:text-black">
                        {log.logout_time ? formatTime(log.logout_time) : (
                          <span className="text-secondary-600 font-medium print:text-black">Active</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <div className="hidden print:block mt-24">
            <div className="flex justify-between">
              <div className="border-t border-black pt-2 px-8">Prepared By</div>
              <div className="border-t border-black pt-2 px-8">Authorized Signature</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Hide layout components during print via global CSS */}
      <style>{`
        @media print {
          body { visibility: hidden; }
          .min-h-screen { min-height: 0 !important; background: white !important; }
          aside, header { display: none !important; }
          main { margin-left: 0 !important; padding: 0 !important; }
          .print\\:block { display: block !important; visibility: visible; }
          .print\\:hidden { display: none !important; }
          .w-full > .space-y-6 { visibility: visible; position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
        }
      `}</style>
    </div>
  );
}
