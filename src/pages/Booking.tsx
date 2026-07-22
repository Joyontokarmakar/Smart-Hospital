import { useEffect, useState, useRef } from 'react';
import { User, ChevronRight, Stethoscope, Clock, CheckCircle2, ClipboardList, Search, FileText, Clipboard, Activity, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../components/NotificationProvider';

type Tab = 'Visit' | 'Tests';

export default function Booking() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { success, error: showError, warning } = useNotification();
  const [activeTab, setActiveTab] = useState<Tab>('Visit');

  const [submitting, setSubmitting] = useState(false);
  
  // Data State
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [todayBookings, setTodayBookings] = useState<any[]>([]);
  
  // Shared Form State (for both tabs)
  const [patientForm, setPatientForm] = useState({
    name: '',
    phone: '',
    age: '',
    gender: 'Male'
  });
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  
  // Visit Tab Specific State
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [session, setSession] = useState<'Morning' | 'Evening'>('Morning');

  // Tests Tab Specific State
  const [selectedTests, setSelectedTests] = useState<any[]>([]);
  const [testSearch, setTestSearch] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [estimateDeliveryDate, setEstimateDeliveryDate] = useState<string>('');
  
  // Suggestion State (Shared)
  const [patientSuggestions, setPatientSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionField, setSuggestionField] = useState<'name' | 'phone' | null>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchInitialData();
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchInitialData = async () => {
    // Fetch Patients
    const { data: pData } = await supabase.from('patients').select('*').order('created_at', { ascending: false });
    if (pData) setPatients(pData);

    // Fetch Doctors
    const { data: dData } = await supabase
      .from('profiles')
      .select('id, full_name, doctors_info(specialization)')
      .eq('role', 'doctor');
    if (dData) setDoctors(dData);

    // Fetch Tests
    const { data: tData } = await supabase.from('tests').select('*').order('name', { ascending: true });
    if (tData) setTests(tData);

    // Fetch Today's Bookings
    const today = new Date().toISOString().split('T')[0];
    const { data: vData } = await supabase
      .from('visits')
      .select('*, patients(name, phone), profiles!doctor_id(full_name)')
      .eq('visit_date', today)
      .order('created_at', { ascending: false });
    if (vData) setTodayBookings(vData);
  };

  const handlePatientFieldChange = (field: string, val: string) => {
    setPatientForm(prev => ({ ...prev, [field]: val }));
    
    if (field === 'name' || field === 'phone') {
      if (val.length > 1) {
        const filtered = patients.filter(p => 
          p[field].toLowerCase().includes(val.toLowerCase())
        );
        setPatientSuggestions(filtered);
        setShowSuggestions(true);
        setSuggestionField(field as 'name' | 'phone');
      } else {
        setShowSuggestions(false);
      }
    }

    if (selectedPatient && selectedPatient[field] !== val) {
      setSelectedPatient(null);
    }
  };

  const selectPatient = (patient: any) => {
    setSelectedPatient(patient);
    setPatientForm({
      name: patient.name,
      phone: patient.phone,
      age: patient.age?.toString() || '',
      gender: patient.gender || 'Male'
    });
    setShowSuggestions(false);
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientForm.name || !patientForm.phone || !selectedDoctor) {
      return warning('Missing Information', 'Please provide patient details and select a doctor.');
    }

    setSubmitting(true);
    try {
      let patientId = selectedPatient?.id;

      if (!patientId) {
        const { data: existing } = await supabase.from('patients').select('id').eq('phone', patientForm.phone).maybeSingle();
        if (existing) {
          patientId = existing.id;
        } else {
          const { data: newP, error: pErr } = await supabase.from('patients').insert({
            name: patientForm.name,
            phone: patientForm.phone,
            age: parseInt(patientForm.age) || null,
            gender: patientForm.gender
          }).select().single();
          
          if (pErr) throw pErr;
          patientId = newP.id;
        }
      } else {
        await supabase.from('patients').update({
          name: patientForm.name,
          age: parseInt(patientForm.age) || null,
          gender: patientForm.gender
        }).eq('id', patientId);
      }

      const today = new Date().toISOString().split('T')[0];
      const { data: maxSerialData } = await supabase
        .from('visits')
        .select('serial_number')
        .eq('doctor_id', selectedDoctor)
        .eq('visit_date', today)
        .eq('session', session)
        .order('serial_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextSerial = (maxSerialData?.serial_number || 0) + 1;

      const { error: vErr } = await supabase.from('visits').insert({
        patient_id: patientId,
        doctor_id: selectedDoctor,
        receptionist_id: profile?.id,
        status: 'queued',
        visit_date: today,
        session: session,
        serial_number: nextSerial
      });

      if (vErr) throw vErr;

      success('Booking Successful', `Patient assigned to Dr. ${doctors.find(d => d.id === selectedDoctor)?.full_name}. Serial #${nextSerial}`);
      setPatientForm({ name: '', phone: '', age: '', gender: 'Male' });
      setSelectedPatient(null);
      setSelectedDoctor('');
      fetchInitialData();
    } catch (err: any) {
      showError('Booking Failed', err.message || 'Error creating booking');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Tests Tab Billing Logic ---
  const filteredTests = tests.filter(t => 
    t.name.toLowerCase().includes(testSearch.toLowerCase())
  );

  const addTest = (test: any) => {
    if (selectedTests.find(t => t.id === test.id)) return;
    setSelectedTests([...selectedTests, test]);
  };

  const removeTest = (id: string) => {
    setSelectedTests(selectedTests.filter(t => t.id !== id));
  };

  const subtotal = selectedTests.reduce((acc, t) => acc + Number(t.price), 0);
  const totalAmount = subtotal - discount;
  const amountDue = totalAmount - paidAmount;
  
   const maxDiscountPercentage = (profile?.role === 'doctor' || profile?.role === 'super_admin') ? 100 : (profile?.max_discount || 0);
   const maxDiscountAmount = (subtotal * maxDiscountPercentage) / 100;
  
  const handleDiscountChange = (val: number) => {
    if (val > maxDiscountAmount) {
      setDiscount(maxDiscountAmount);
    } else {
      setDiscount(val);
    }
  };

  const handleTestSubmit = async () => {
    if (!patientForm.name || !patientForm.phone || selectedTests.length === 0) {
      alert("Please ensure patient name, phone and at least one test are selected.");
      return;
    }
    
    setSubmitting(true);
    try {
      let patientId = selectedPatient?.id;
      if (!patientId) {
        const { data: existing } = await supabase.from('patients').select('id').eq('phone', patientForm.phone).maybeSingle();
        if (existing) {
          patientId = existing.id;
        } else {
          const { data: newP, error: pErr } = await supabase.from('patients').insert({
            name: patientForm.name,
            phone: patientForm.phone,
            age: parseInt(patientForm.age) || null,
            gender: patientForm.gender
          }).select().single();
          if (pErr) throw pErr;
          patientId = newP.id;
        }
      }

      const { data: bill, error: billError } = await supabase
        .from('bills')
        .insert({
          patient_id: patientId,
          receptionist_id: profile?.id,
          subtotal,
          total_discount: discount,
          total_amount: totalAmount,
          amount_paid: paidAmount,
          amount_due: amountDue,
          estimate_delivery_date: estimateDeliveryDate ? new Date(estimateDeliveryDate).toISOString() : null,
          status: amountDue <= 0 ? 'paid' : 'pending'
        })
        .select()
        .single();

      if (billError) throw billError;

      const billItems = selectedTests.map(t => ({
        bill_id: bill.id,
        test_id: t.id,
        test_name: t.name,
        price: t.price,
        discount: 0,
        final_price: t.price,
        expected_delivery: estimateDeliveryDate ? new Date(estimateDeliveryDate).toISOString() : null,
        report_status: 'Pending'
      }));

      const { error: itemsError } = await supabase.from('bill_items').insert(billItems);
      if (itemsError) throw itemsError;

      setSelectedPatient(null);
      setPatientForm({ name: '', phone: '', age: '', gender: 'Male' });
      setSelectedTests([]);
      setDiscount(0);
      setPaidAmount(0);
      setEstimateDeliveryDate('');
      success('Success', 'Test Bill Generated Successfully!');
      navigate(`/billing?billId=${bill.id}&print=true`);
      fetchInitialData();
    } catch (err: any) {
      showError('Error', err.message || 'Error generating bill');
    } finally {
      setSubmitting(false);
    }
  };

  const renderPatientInfoCard = () => (
    <Card className="overflow-visible">
      <CardHeader className="flex flex-row justify-start items-center gap-3">
        <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
          <User className="w-5 h-5" />
        </div>
        <div>
          <CardTitle>Patient Information</CardTitle>
          <p className="text-xs text-slate-500">Enter patient details. Suggestions will appear as you type name or phone.</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Input 
              label="Patient Name" 
              placeholder="Type name..." 
              value={patientForm.name}
              onChange={(e) => handlePatientFieldChange('name', e.target.value)}
            />
            {showSuggestions && suggestionField === 'name' && patientSuggestions.length > 0 && (
              <div ref={suggestionRef} className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-fade-in-up">
                {patientSuggestions.map(p => (
                  <button 
                    key={p.id}
                    type="button"
                    className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between border-b last:border-b-0 border-slate-100 transition-colors"
                    onClick={() => selectPatient(p)}
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.phone}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <Input 
              label="Phone Number" 
              placeholder="Type phone..." 
              value={patientForm.phone}
              onChange={(e) => handlePatientFieldChange('phone', e.target.value)}
            />
            {showSuggestions && suggestionField === 'phone' && patientSuggestions.length > 0 && (
              <div ref={suggestionRef} className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-fade-in-up">
                {patientSuggestions.map(p => (
                  <button 
                    key={p.id}
                    type="button"
                    className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between border-b last:border-b-0 border-slate-100 transition-colors"
                    onClick={() => selectPatient(p)}
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.phone}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input 
            label="Age" 
            type="number" 
            placeholder="Enter age" 
            value={patientForm.age}
            onChange={(e) => handlePatientFieldChange('age', e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
            <select
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none"
              value={patientForm.gender}
              onChange={(e) => handlePatientFieldChange('gender', e.target.value)}
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 pb-12">
      <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
        <button 
          onClick={() => setActiveTab('Visit')}
          className={`px-6 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'Visit' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Visit
        </button>
        <button 
          onClick={() => setActiveTab('Tests')}
          className={`px-6 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'Tests' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Tests
        </button>
      </div>

      {activeTab === 'Visit' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {renderPatientInfoCard()}
            
            <Card>
              <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-secondary-50 rounded-lg text-secondary-600">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                  <CardTitle>Doctor Assignment</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleBookingSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Select Doctor</label>
                      <select
                        value={selectedDoctor}
                        onChange={(e) => setSelectedDoctor(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none appearance-none cursor-pointer"
                        required
                      >
                        <option value="" disabled>Choose a doctor...</option>
                        {doctors.map(d => (
                          <option key={d.id} value={d.id}>
                            Dr. {d.full_name} {d.doctors_info?.[0]?.specialization ? `(${d.doctors_info[0].specialization})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Session</label>
                      <div className="flex bg-slate-100 p-1 rounded-xl">
                        {(['Morning', 'Evening'] as const).map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setSession(s)}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                              session === s ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            {s} Path
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full py-4 text-base font-bold shadow-lg shadow-primary-500/20 rounded-2xl"
                    isLoading={submitting}
                    leftIcon={<CheckCircle2 className="w-5 h-5" />}
                  >
                    Confirm & Generate Serial
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
          
          <div className="lg:col-span-1">
             <Card className="bg-gradient-to-br from-primary-600 to-primary-700 text-white border-none shadow-xl shadow-primary-500/20">
                <CardContent className="p-6">
                   <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                         <Clock className="w-5 h-5 text-white" />
                      </div>
                      <CardTitle className="text-white">Quick Stats</CardTitle>
                   </div>
                   <div className="space-y-4">
                      <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/5">
                         <p className="text-primary-100 text-xs font-bold uppercase tracking-wider mb-1">Today's Bookings</p>
                         <p className="text-3xl font-black">{todayBookings.length}</p>
                      </div>
                   </div>
                </CardContent>
             </Card>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {renderPatientInfoCard()}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-secondary-50 rounded-lg text-secondary-600">
                    <Clipboard className="w-5 h-5" />
                  </div>
                  <CardTitle>Select Tests</CardTitle>
                </div>
                <div className="relative w-full sm:w-64">
                   <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                   <input 
                    type="text" 
                    placeholder="Search test..." 
                    className="w-full pl-9 pr-4 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none bg-white"
                    value={testSearch}
                    onChange={(e) => setTestSearch(e.target.value)}
                   />
                </div>
              </CardHeader>
              <CardContent className="pt-4 px-4 overflow-hidden">
                <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredTests.map(test => {
                    const isSelected = selectedTests.find(t => t.id === test.id);
                    return (
                      <button
                        key={test.id}
                        type="button"
                        onClick={() => isSelected ? removeTest(test.id) : addTest(test)}
                        className={`p-3 rounded-xl border flex items-center justify-between transition-all group ${
                          isSelected 
                            ? 'bg-secondary-50 border-secondary-200 ring-1 ring-secondary-500/10' 
                            : 'bg-white border-slate-100 hover:border-secondary-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSelected ? 'bg-secondary-100 text-secondary-600' : 'bg-slate-50 text-slate-400'}`}>
                            {isSelected ? <Check className="w-5 h-5" /> : <Activity className="w-5 h-5 opacity-50" />}
                          </div>
                          <div>
                            <p className={`font-semibold text-sm ${isSelected ? 'text-secondary-700' : 'text-slate-800'}`}>{test.name}</p>
                            <p className="text-[10px] text-slate-400 font-medium">Available Price: ৳{test.price}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-bold ${isSelected ? 'text-secondary-600' : 'text-slate-600'}`}>৳{test.price}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="bg-white border border-slate-200 shadow-xl overflow-hidden sticky top-6">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-slate-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary-600" />
                  Billing Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-3">
                  {selectedTests.map(t => (
                    <div key={t.id} className="flex justify-between text-sm animate-fade-in text-slate-800">
                      <span className="truncate pr-4 font-medium">{t.name}</span>
                      <span className="font-mono font-bold">৳{Number(t.price).toFixed(2)}</span>
                    </div>
                  ))}
                  {selectedTests.length === 0 && (
                    <p className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/30">
                      No tests selected
                    </p>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-6 space-y-4">
                  <div className="flex justify-between text-slate-600">
                    <span className="font-medium">Subtotal</span>
                    <span className="font-mono text-slate-900 font-bold">৳{subtotal.toFixed(2)}</span>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-100">
                     <div className="space-y-2">
                        <label className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          <span>Discount</span>
                          <span className="text-secondary-600 font-mono">Max {maxDiscountPercentage}%</span>
                        </label>
                        <div className="relative">
                          <div className="w-full flex items-center px-3 py-2 border border-slate-200 rounded-xl bg-white focus-within:ring-2 focus-within:ring-primary-500/10 focus-within:border-primary-500 transition-all">
                            <span className="text-slate-400 mr-2 font-mono">৳</span>
                            <input 
                              type="number" 
                              className="w-full bg-transparent border-none outline-none text-slate-900 font-semibold"
                              placeholder="0.00"
                              value={discount || ''}
                              onChange={(e) => handleDiscountChange(Number(e.target.value))}
                            />
                          </div>
                        </div>
                     </div>

                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Amount Paid</label>
                        <div className="relative">
                          <div className="w-full flex items-center px-4 py-3 border border-slate-200 rounded-2xl bg-white focus-within:border-primary-500 transition-all">
                            <span className="text-slate-400 mr-2 font-mono font-bold">৳</span>
                            <input 
                              type="number" 
                              className="w-full bg-transparent border-none outline-none text-slate-900 font-bold"
                              placeholder="0"
                              value={paidAmount || ''}
                              onChange={(e) => setPaidAmount(Number(e.target.value))}
                            />
                          </div>
                        </div>
                     </div>
                     
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Est. Delivery Date</label>
                        <input 
                          type="date"
                          className="w-full px-4 py-3 border border-slate-200 rounded-2xl bg-white focus:border-primary-500 transition-all outline-none font-semibold text-sm"
                          value={estimateDeliveryDate}
                          onChange={(e) => setEstimateDeliveryDate(e.target.value)}
                          required
                        />
                     </div>

                     <div className="flex justify-between items-center px-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Due</span>
                        <span className={`text-lg font-mono font-black ${amountDue > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                          ৳{Math.max(0, amountDue).toFixed(2)}
                        </span>
                     </div>
                  </div>

                  <div className="flex justify-between text-2xl font-black pt-6 border-t border-slate-100 text-slate-900">
                    <span>Total</span>
                    <span className="text-primary-600 font-mono">৳{totalAmount.toFixed(2)}</span>
                  </div>
                </div>

                <Button 
                  variant="primary" 
                  className="w-full py-4 text-lg shadow-xl shadow-primary-500/20 font-bold rounded-2xl"
                  disabled={!patientForm.name || !patientForm.phone || selectedTests.length === 0 || !estimateDeliveryDate || submitting}
                  onClick={handleTestSubmit}
                  isLoading={submitting}
                >
                  Confirm & Print Bill
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Today's List (Always visible at bottom) */}
      <Card className="border-slate-100 shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-100">
               <ClipboardList className="w-5 h-5 text-slate-500" />
            </div>
            <CardTitle>Today's Patient Queue</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 text-[10px] uppercase font-bold tracking-widest">
                  <th className="px-6 py-4">Serial</th>
                  <th className="px-6 py-4">Patient Name</th>
                  <th className="px-6 py-4">Assigned Doctor</th>
                  <th className="px-6 py-4">Session</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {todayBookings.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">No bookings yet.</td></tr>
                ) : todayBookings.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-black text-primary-600">#{v.serial_number}</td>
                    <td className="px-6 py-4">
                       <span className="font-bold text-slate-900">{v.patients?.name}</span>
                       <p className="text-[10px] text-slate-400">{v.patients?.phone}</p>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700">Dr. {v.profiles?.full_name}</td>
                    <td className="px-6 py-4">
                       <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight ${v.session === 'Morning' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'}`}>
                          {v.session}
                       </span>
                    </td>
                    <td className="px-6 py-4">
                       <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight 
                        ${v.status === 'queued' ? 'bg-warning-50 text-warning-700 border border-warning-100' : 
                          v.status === 'completed' ? 'bg-success-50 text-success-700 border border-success-100' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-[10px] font-bold text-slate-400">
                       {new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
