import { Printer, ArrowLeft } from 'lucide-react';
import { Button } from './Button';
import { Card, CardContent } from './Card';

interface ReceiptProps {
  bill: any;
  settings: any;
  onBack?: () => void;
  onNew?: () => void;
}

export function Receipt({ bill, settings, onBack, onNew }: ReceiptProps) {
  if (!bill) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center print:hidden">
        {onBack && (
          <Button 
            variant="outline" 
            onClick={onBack}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Back
          </Button>
        )}
        <div className="flex gap-2 ml-auto">
          <Button 
            onClick={() => window.print()}
            leftIcon={<Printer className="w-4 h-4" />}
          >
            Print Receipt
          </Button>
          {onNew && (
            <Button 
              variant="outline"
              onClick={onNew}
            >
              New Bill
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto">
        <Card className="print:shadow-none print:border-none">
          <CardContent className="p-8">
            {/* Receipt Header */}
            <div className="text-center mb-8 border-b border-slate-100 pb-6 print:border-black">
              {settings?.logo_url ? (
                <div className="flex justify-center mb-4">
                  <img src={settings.logo_url} alt="Hospital Logo" className="h-16 object-contain" />
                </div>
              ) : (
                <h2 className="text-2xl font-bold uppercase text-slate-800 print:text-black">{settings?.name || 'Smart Hospital'}</h2>
              )}
              <p className="text-slate-500 text-sm print:text-black">{settings?.address || '123 Health Ave'}</p>
              <p className="text-slate-400 text-xs mt-1 print:text-black">{settings?.contact_info || 'Contact Info'}</p>
              <div className="mt-4 inline-block bg-primary-50 text-primary-700 px-4 py-1 rounded-full text-sm font-bold uppercase tracking-wider print:bg-transparent print:border print:border-black print:text-black">
                Diagnostic Cash Receipt
              </div>
            </div>

            {/* Patient & Bill Info */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 print:text-black">Patient Information</h3>
                <p className="font-bold text-slate-900 print:text-lg print:text-black">{bill.patient?.name || bill.patients?.name}</p>
                <p className="text-sm text-slate-600 print:text-black">Phone: {bill.patient?.phone || bill.patients?.phone}</p>
                {(bill.patient?.age || bill.patients?.age) && (
                  <p className="text-sm text-slate-600 print:text-black">Age/Gender: {bill.patient?.age || bill.patients?.age}y, {bill.patient?.gender || bill.patients?.gender}</p>
                )}
              </div>
              <div className="text-right">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 print:text-black">Bill Details</h3>
                <p className="text-sm text-slate-600 print:text-black"><span className="font-medium">Bill ID:</span> #{bill.id.slice(0, 8)}</p>
                <p className="text-sm text-slate-600 print:text-black"><span className="font-medium">Date:</span> {new Date(bill.created_at).toLocaleDateString()}</p>
                <p className="text-sm text-slate-600 print:text-black"><span className="font-medium">Time:</span> {new Date(bill.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>

            {/* Items Table */}
            <table className="w-full mb-8 border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest print:border-black print:text-black">
                  <th className="py-3">Service / Test</th>
                  <th className="py-3 text-right">Price</th>
                  <th className="py-3 text-right">Discount</th>
                  <th className="py-3 text-right">Net Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 print:divide-slate-200">
                {(bill.items || bill.bill_items || []).map((item: any) => (
                  <tr key={item.id || item.test_id}>
                    <td className="py-4">
                      <p className="font-medium text-slate-900 print:text-black">{item.test_name}</p>
                      {item.expected_delivery && (
                        <p className="text-[10px] text-slate-400 print:text-black">Delivery: {new Date(item.expected_delivery).toLocaleDateString()}</p>
                      )}
                    </td>
                    <td className="py-4 text-right text-sm text-slate-600 print:text-black">৳{item.price.toFixed(2)}</td>
                    <td className="py-4 text-right text-sm text-slate-600 print:text-black">৳{item.discount.toFixed(2)}</td>
                    <td className="py-4 text-right text-sm font-bold text-slate-900 print:text-black">৳{item.final_price.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Summaries */}
            <div className="flex justify-end border-t border-slate-100 pt-6 print:border-black">
              <div className="w-full sm:w-64 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 print:text-black">Subtotal</span>
                  <span className="font-medium text-slate-900 print:text-black">৳{bill.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 print:text-black">Total Discount</span>
                  <span className="font-medium text-success-600 print:text-black">- ৳{bill.total_discount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-slate-100 pt-3 print:border-black">
                  <span className="text-slate-900 print:text-black">Total</span>
                  <span className="text-primary-700 print:text-black">৳{bill.total_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2">
                  <span className="text-slate-500 print:text-black">Amount Paid</span>
                  <span className="font-bold text-success-600 print:text-black">৳{bill.amount_paid.toFixed(2)}</span>
                </div>
                {bill.amount_due > 0 && (
                  <div className="flex justify-between text-sm bg-error-50 px-3 py-2 rounded-lg print:bg-transparent print:px-0">
                    <span className="text-error-700 font-bold print:text-black">Due Amount</span>
                    <span className="text-error-700 font-bold print:text-black">৳{bill.amount_due.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Signatures */}
            <div className="mt-20 grid grid-cols-2 gap-20">
              <div className="text-center pt-4 border-t border-slate-200 print:border-black">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest print:text-black">Patient Signature</p>
              </div>
              <div className="text-center pt-4 border-t border-slate-200 print:border-black">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest print:text-black">Authorized Signature</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <style>{`
        @media print {
          @page { margin: 10mm; }
          body * { visibility: hidden; }
          #root, .space-y-6, .max-w-3xl, .max-w-3xl * { visibility: visible; }
          .max-w-3xl { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
          .print\\:hidden { display: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-none { border: none !important; }
          aside, header, nav { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}
