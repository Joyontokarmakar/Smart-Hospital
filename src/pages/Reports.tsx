import { useEffect, useState } from 'react';
import { Download, FileText, Calendar as CalendarIcon, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import { Button } from '../components/Button';

export default function Reports() {
  const [reportType, setReportType] = useState<'bills' | 'visits'>('bills');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReportData();
  }, [reportType, startDate, endDate]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      if (reportType === 'bills') {
        const { data: bills } = await supabase
          .from('bills')
          .select('id, created_at, subtotal, total_discount, total_amount, status, patients(name)')
          .gte('created_at', `${startDate}T00:00:00.000Z`)
          .lte('created_at', `${endDate}T23:59:59.999Z`)
          .order('created_at', { ascending: false });
        setData(bills || []);
      } else {
        const { data: visits } = await supabase
          .from('visits')
          .select('id, created_at, visit_date, status, patients(name), profiles!doctor_id(full_name)')
          .gte('visit_date', startDate)
          .lte('visit_date', endDate)
          .order('visit_date', { ascending: false });
        setData(visits || []);
      }
    } catch (err) {
      console.error("Error fetching report", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = () => {
    if (data.length === 0) return alert('No data to export');

    let csvContent = "data:text/csv;charset=utf-8,";
    
    if (reportType === 'bills') {
      csvContent += "Date,Patient Name,Subtotal,Discount,Total Amount,Status\n";
      data.forEach(row => {
        const date = new Date(row.created_at).toLocaleDateString();
        const patient = `"${row.patients?.name || ''}"`;
        const subtotal = row.subtotal;
        const discount = row.total_discount;
        const total = row.total_amount;
        const status = row.status;
        csvContent += `${date},${patient},${subtotal},${discount},${total},${status}\n`;
      });
    } else {
      csvContent += "Date,Patient Name,Doctor Name,Status\n";
      data.forEach(row => {
        const date = new Date(row.visit_date).toLocaleDateString();
        const patient = `"${row.patients?.name || ''}"`;
        const doctor = `"${row.profiles?.full_name || ''}"`;
        const status = row.status;
        csvContent += `${date},${patient},${doctor},${status}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${reportType}_report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalRevenue = reportType === 'bills' 
    ? data.reduce((sum, item) => sum + (item.total_amount || 0), 0)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Reports & Analytics</h1>
          <p className="text-slate-500 text-sm mt-1">Download monthly generated reports.</p>
        </div>
        <Button 
          onClick={handleDownloadCSV}
          leftIcon={<Download className="w-4 h-4" />}
          disabled={data.length === 0 || loading}
          className="shadow-lg shadow-primary-500/30 w-full sm:w-auto"
        >
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 border-primary-100 shadow-md">
          <CardHeader className="bg-slate-50 border-b border-primary-50">
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              Report Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Report Type</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as any)}
                className="w-full border border-slate-200 rounded-lg focus:ring-primary-500 py-2.5 px-3 outline-none"
              >
                <option value="bills">Patient Test Bills</option>
                <option value="visits">Doctor Visits</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg focus:ring-primary-500 py-2.5 px-3 outline-none"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg focus:ring-primary-500 py-2.5 px-3 outline-none"
              />
            </div>

            {reportType === 'bills' && (
              <div className="mt-6 p-4 bg-primary-50 rounded-xl border border-primary-100">
                <p className="text-sm font-medium text-primary-800 mb-1">Total Period Revenue</p>
                <p className="text-3xl font-bold text-primary-900">৳{totalRevenue.toFixed(2)}</p>
              </div>
            )}
            {reportType === 'visits' && (
              <div className="mt-6 p-4 bg-secondary-50 rounded-xl border border-secondary-100">
                <p className="text-sm font-medium text-secondary-800 mb-1">Total Appointments</p>
                <p className="text-3xl font-bold text-secondary-900">{data.length}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {reportType === 'bills' ? <FileText className="w-5 h-5" /> : <CalendarIcon className="w-5 h-5" />}
              {reportType === 'bills' ? 'Billing Records' : 'Appointment Records'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 shadow-sm z-10">
                  <tr className="text-slate-600 text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 font-semibold">Date</th>
                    <th className="px-6 py-4 font-semibold">Patient Name</th>
                    {reportType === 'bills' ? (
                      <>
                        <th className="px-6 py-4 font-semibold text-right">Amount</th>
                        <th className="px-6 py-4 font-semibold text-center">Status</th>
                      </>
                    ) : (
                      <>
                        <th className="px-6 py-4 font-semibold">Doctor</th>
                        <th className="px-6 py-4 font-semibold text-center">Status</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={4} className="p-8 text-center text-slate-500">Generating report...</td></tr>
                  ) : data.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-slate-500">No records found for the selected period.</td></tr>
                  ) : (
                    data.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-sm whitespace-nowrap">
                          {new Date(reportType === 'bills' ? row.created_at : row.visit_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{row.patients?.name}</td>
                        {reportType === 'bills' ? (
                          <>
                            <td className="px-6 py-4 text-sm text-right font-medium">৳{row.total_amount?.toFixed(2)}</td>
                            <td className="px-6 py-4 text-center">
                              <span className="text-xs font-medium px-2 py-1 bg-success-50 text-success-700 rounded-full">
                                {row.status}
                              </span>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-6 py-4 text-sm text-slate-600 truncate max-w-[150px]">
                              Dr. {row.profiles?.full_name}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-700 rounded-full capitalize">
                                {row.status.replace('_', ' ')}
                              </span>
                            </td>
                          </>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
