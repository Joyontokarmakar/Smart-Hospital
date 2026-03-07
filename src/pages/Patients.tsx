import { useEffect, useState } from 'react';
import { Plus, Search, FileText, Calendar as CalendarIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import { Button } from '../components/Button';
import { PatientModal } from '../components/PatientModal';

export default function Patients() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setPatients(data);
    }
    setLoading(false);
  };

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.phone.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Patients Repository</h1>
          <p className="text-slate-500 text-sm mt-1">Manage patient records, billing, and appointments.</p>
        </div>
        <Button 
          onClick={() => setIsModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
          className="shadow-lg shadow-primary-500/30 w-full sm:w-auto"
        >
          Register Patient
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Patients</CardTitle>
          <div className="relative w-full sm:w-72 mt-3 sm:mt-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name or phone..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-slate-50 focus:bg-white transition-colors"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">Patient Name</th>
                  <th className="px-6 py-4 font-semibold">Phone Number</th>
                  <th className="px-6 py-4 font-semibold">Age/Gender</th>
                  <th className="px-6 py-4 font-semibold text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      Loading patients...
                    </td>
                  </tr>
                ) : filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      No matching patients found.
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-200">
                            {patient.name.charAt(0).toUpperCase()}
                          </div>
                          <p className="font-medium text-slate-900">{patient.name}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 border-b border-slate-100 text-slate-600 font-medium">
                        {patient.phone}
                      </td>
                      <td className="px-6 py-4 border-b border-slate-100 text-slate-500 text-sm">
                        {patient.age ? `${patient.age}y` : 'N/A'}, {patient.gender}
                      </td>
                      <td className="px-6 py-4 border-b border-slate-100 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="secondary" 
                            size="sm"
                            leftIcon={<FileText className="w-3.5 h-3.5" />}
                            onClick={() => navigate(`/billing/new?patient=${patient.id}`)}
                          >
                            Bill
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            leftIcon={<CalendarIcon className="w-3.5 h-3.5 text-primary-600" />}
                            onClick={() => navigate(`/appointments/new?patient=${patient.id}`)}
                            className="bg-primary-50/50 border-primary-200 text-primary-700 hover:bg-primary-100"
                          >
                            Assign Dr.
                          </Button>
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
        <PatientModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={() => {
            setIsModalOpen(false);
            fetchPatients();
            // Optionally auto-navigate to billing or appointment
          }}
        />
      )}
    </div>
  );
}
