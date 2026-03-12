import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, Printer, ArrowLeft, Eye, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import { Button } from '../components/Button';
import { useNotification } from '../components/NotificationProvider';
import { Receipt } from '../components/Receipt';

export default function Billing() {
  const { profile } = useAuth();
  const { settings } = useSettings();
  const { success, error: showError } = useNotification();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const patientId = searchParams.get('patient');
  
  const [patient, setPatient] = useState<any>(null);
  const [allTests, setAllTests] = useState<any[]>([]);
  const [selectedTests, setSelectedTests] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastCreatedBill, setLastCreatedBill] = useState<any>(null);

  useEffect(() => {
    const billId = searchParams.get('billId');
    if (billId) {
      fetchBillDetails(billId);
    } else if (patientId) {
      fetchPatientAndTests(patientId);
    } else {
      fetchBills();
    }
  }, [patientId, searchParams]);

  const fetchBillDetails = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bills')
        .select('*, patients(*), bill_items(*)')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      if (data) {
        setLastCreatedBill(data);
        setShowReceipt(true);
        if (searchParams.get('print') === 'true') {
          setTimeout(() => window.print(), 1000);
        }
      }
    } catch (err: any) {
      showError('Error fetching bill', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPatientAndTests = async (id: string) => {
    setLoading(true);
    const { data: pData } = await supabase.from('patients').select('*').eq('id', id).single();
    if (pData) setPatient(pData);

    const { data: tData } = await supabase.from('tests').select('*').order('name');
    if (tData) setAllTests(tData);
    setLoading(false);
  };

  const fetchBills = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('bills')
      .select('*, patients(name, phone), profiles!receptionist_id(full_name)')
      .order('created_at', { ascending: false });
    if (data) setBills(data);
    setLoading(false);
  };

  const handleUpdateStatus = async (bill: any, newStatus: string) => {
    try {
      const updates: any = { status: newStatus };
      if (newStatus === 'paid') {
        updates.amount_paid = bill.total_amount;
        updates.amount_due = 0;
      }

      const { error } = await supabase
        .from('bills')
        .update(updates)
        .eq('id', bill.id);

      if (error) throw error;
      success('Success', `Bill status updated to ${newStatus}`);
      fetchBills();
    } catch (err: any) {
      showError('Update Failed', err.message);
    }
  };

  const handleAddTest = (testId: string) => {
    if (!testId) return;
    const test = allTests.find(t => t.id === testId);
    if (test && !selectedTests.find(t => t.id === test.id)) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setSelectedTests([...selectedTests, { 
        ...test, 
        appliedDiscount: 0,
        expected_delivery: tomorrow.toISOString().split('T')[0]
      }]);
    }
  };

  const handleRemoveTest = (testId: string) => {
    setSelectedTests(selectedTests.filter(t => t.id !== testId));
  };

  const handleDeliveryChange = (testId: string, value: string) => {
    setSelectedTests(selectedTests.map(t => {
      if (t.id === testId) return { ...t, expected_delivery: value };
      return t;
    }));
  };

  const handleDiscountChange = (testId: string, value: string) => {
    const amount = parseFloat(value) || 0;
    setSelectedTests(selectedTests.map(t => {
      if (t.id === testId) {
        // Enforce max discount
        const maxAllowedStr = (t.price * ((profile?.max_discount || 0) / 100)).toFixed(2);
        const maxAllowed = parseFloat(maxAllowedStr);
        let validAmount = amount;
        if (amount > maxAllowed) validAmount = maxAllowed;
        if (amount < 0) validAmount = 0;
        return { ...t, appliedDiscount: validAmount };
      }
      return t;
    }));
  };

  const subtotal = selectedTests.reduce((sum, t) => sum + t.price, 0);
  const totalDiscount = selectedTests.reduce((sum, t) => sum + (t.appliedDiscount || 0), 0);
  const totalAmount = subtotal - totalDiscount;
  const parsedAmountPaid = parseFloat(amountPaid) || 0;
  const amountDue = totalAmount - parsedAmountPaid;

  const handleCreateBill = async () => {
    if (selectedTests.length === 0) return alert('Select at least one test.');

    try {
      setLoading(true);
      // Create bill
      const { data: bill, error: billError } = await supabase
        .from('bills')
        .insert({
          patient_id: patientId,
          receptionist_id: profile?.id,
          subtotal,
          total_discount: totalDiscount,
          total_amount: totalAmount,
          amount_paid: parsedAmountPaid,
          amount_due: amountDue,
          status: amountDue > 0 ? 'pending' : 'paid'
        })
        .select()
        .single();
      
      if (billError) throw billError;

      // Create bill items
      const billItems = selectedTests.map(t => ({
        bill_id: bill.id,
        test_id: t.id,
        test_name: t.name,
        price: t.price,
        discount: t.appliedDiscount,
        final_price: t.price - t.appliedDiscount,
        expected_delivery: t.expected_delivery ? new Date(t.expected_delivery).toISOString() : null,
        report_status: 'Pending'
      }));

      const { error: itemsError } = await supabase.from('bill_items').insert(billItems);
      if (itemsError) throw itemsError;

      success('Bill created!', 'Proceeding to receipt preview.');
      setLastCreatedBill({
        ...bill,
        items: billItems,
        patient,
        settings
      });
      setShowReceipt(true);

    } catch (err: any) {
      showError('Error creating bill', err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Render Receipt View
  if (showReceipt && lastCreatedBill) {
    return (
      <Receipt 
        bill={lastCreatedBill} 
        settings={settings}
        onBack={() => {
          setShowReceipt(false);
          setLastCreatedBill(null);
          navigate('/billing');
        }}
        onNew={() => {
          setShowReceipt(false);
          setLastCreatedBill(null);
          setSelectedTests([]);
          setAmountPaid('');
          navigate('/billing');
        }}
      />
    );
  }

  // Render "Create Bill" View
  if (patientId) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/booking')} className="p-2 hover:bg-slate-200 rounded-full transition">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Create Bill</h1>
              <p className="text-slate-500 text-sm mt-1">Generate a diagnostic test bill.</p>
            </div>
          </div>
          <Button 
            onClick={handleCreateBill}
            leftIcon={<Printer className="w-4 h-4" />}
            disabled={selectedTests.length === 0 || loading}
          >
            Generate & Preview
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Add Tests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full sm:max-w-md mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Select Diagnostic Test</label>
                  <select
                    className="w-full border-slate-200 rounded-lg focus:ring-primary-500 py-2.5 px-3 border outline-none bg-slate-50"
                    onChange={(e) => handleAddTest(e.target.value)}
                    value=""
                  >
                    <option value="" disabled>-- Select a test to add --</option>
                    {allTests.map(t => (
                      <option key={t.id} value={t.id}>{t.name} (৳{t.price})</option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>
            
            {/* Selected Tests List */}
            {selectedTests.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Selected Tests</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 text-xs uppercase tracking-wider">
                          <th className="px-6 py-4 font-semibold">Test</th>
                          <th className="px-6 py-4 font-semibold text-right">Price</th>
                          <th className="px-6 py-4 font-semibold text-right" title="Cannot exceed max discount">Disc. (৳)</th>
                          <th className="px-6 py-4 font-semibold text-right">Net</th>
                          <th className="px-6 py-4 font-semibold">Delivery Date</th>
                          <th className="px-6 py-4 font-semibold text-center">Action</th>
                        </tr>
                      </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedTests.map(t => {
                        const maxDiscAmt = t.price * ((profile?.max_discount || 0) / 100);
                        return (
                          <tr key={t.id}>
                            <td className="px-6 py-4 text-sm font-medium text-slate-900">{t.name}</td>
                            <td className="px-6 py-4 text-sm text-right">৳{t.price.toFixed(2)}</td>
                            <td className="px-6 py-4 text-sm text-right">
                              <input 
                                type="number" 
                                min="0" 
                                max={maxDiscAmt}
                                step="0.01"
                                className="w-20 text-right border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-primary-500"
                                value={t.appliedDiscount === 0 ? '' : t.appliedDiscount}
                                placeholder="0.00"
                                onChange={(e) => handleDiscountChange(t.id, e.target.value)}
                              />
                              <div className="text-[10px] text-slate-400 mt-1">Max: ৳{maxDiscAmt.toFixed(2)}</div>
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-primary-700 text-right">
                              ৳{(t.price - t.appliedDiscount).toFixed(2)}
                            </td>
                            <td className="px-6 py-4">
                              <input 
                                type="date"
                                className="border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-primary-500 min-w-[120px]"
                                value={t.expected_delivery || ''}
                                onChange={(e) => handleDeliveryChange(t.id, e.target.value)}
                              />
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button onClick={() => handleRemoveTest(t.id)} className="text-error-500 hover:text-error-700 text-sm font-medium">Remove</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-1">
            {/* Summary Card */}
            <Card>
              <CardHeader>
                <CardTitle>Bill Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Patient Info</h3>
                    <p className="font-bold text-slate-900 mt-1">{patient?.name}</p>
                    <p className="text-slate-600">Phone: {patient?.phone}</p>
                    {patient?.age && <p className="text-slate-600">Age/Gender: {patient?.age}y, {patient?.gender}</p>}
                    <p className="text-slate-600 mt-2 text-sm">Date: {new Date().toLocaleDateString()}</p>
                  </div>

                  <div className="border-t border-slate-200 pt-4 mt-6">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-600">Subtotal</span>
                      <span className="font-medium text-slate-900">৳{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2 text-success-600">
                      <span>Total Discount</span>
                      <span>- ৳{totalDiscount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-slate-900 mt-4 pt-4 border-t border-slate-200">
                      <span>Total Amount</span>
                      <span>৳{totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-slate-700">Advance / Amount Paid</label>
                      <input 
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-32 text-right border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">Due Amount</span>
                      <span className={`font-bold ${amountDue > 0 ? 'text-error-600' : 'text-success-600'}`}>
                        ৳{amountDue > 0 ? amountDue.toFixed(2) : '0.00'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Render "Recent Bills" View
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => navigate('/booking')} leftIcon={<Plus className="w-4 h-4" />}>
          New Bill
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Bills</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Patient</th>
                  <th className="px-6 py-4 text-right">Subtotal</th>
                  <th className="px-6 py-4 text-right">Discount</th>
                  <th className="px-6 py-4 text-right">Total</th>
                  <th className="px-6 py-4 text-right">Paid</th>
                  <th className="px-6 py-4 text-right">Due</th>
                   <th className="px-6 py-4 text-center">Status</th>
                   <th className="px-6 py-4 text-right">Actions</th>
                 </tr>
               </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">Loading bills...</td>
                  </tr>
                ) : bills.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">No bills found.</td>
                  </tr>
                ) : (
                  bills.map(bill => (
                    <tr key={bill.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0">
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-slate-700">{new Date(bill.created_at).toLocaleDateString()}</span>
                        <p className="text-[10px] text-slate-400 font-medium">{new Date(bill.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-black text-slate-900">{bill.patients?.name || 'Unknown'}</span>
                        <p className="text-[10px] text-slate-400">{bill.patients?.phone}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-xs font-bold text-slate-600">৳{bill.subtotal.toFixed(2)}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <span className="text-xs font-bold text-secondary-600">৳{bill.total_discount.toFixed(2)}</span>
                         <div className="flex items-center justify-end gap-1 mt-0.5">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">By:</span>
                            <span className="text-[9px] font-black text-slate-500">{bill.profiles?.full_name?.split(' ')[0] || 'System'}</span>
                         </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-black text-slate-900">৳{bill.total_amount.toFixed(2)}</span>
                      </td>
                      <td className="px-6 py-4 text-right font-black text-success-600 text-sm">৳{bill.amount_paid.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`text-sm font-black ${bill.amount_due > 0 ? 'text-rose-500' : 'text-slate-300'}`}>
                          ৳{bill.amount_due > 0 ? bill.amount_due.toFixed(2) : '0.00'}
                        </span>
                      </td>
                      
                       <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter border
                          ${bill.status === 'paid' ? 'bg-success-50 text-success-700 border-success-200' : ''}
                          ${bill.status === 'pending' ? 'bg-warning-50 text-warning-700 border-warning-200' : ''}
                          ${bill.status === 'cancelled' ? 'bg-error-50 text-error-700 border-error-200' : ''}
                        `}>
                          {bill.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => fetchBillDetails(bill.id)}
                            className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="View Receipt"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {bill.status === 'pending' && (
                            <button
                              onClick={() => handleUpdateStatus(bill, 'paid')}
                              className="p-1.5 text-slate-400 hover:text-success-600 hover:bg-success-50 rounded-lg transition-colors"
                              title="Mark as Paid"
                            >
                              <Check className="w-4 h-4" />
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
    </div>
  );
}
