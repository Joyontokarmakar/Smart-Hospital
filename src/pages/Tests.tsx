import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import { Button } from '../components/Button';
import { useNotification } from '../components/NotificationProvider';
import { TestModal } from '../components/TestModal';
import { ConfirmModal } from '../components/ConfirmModal';

export default function Tests() {
  const { error: showError } = useNotification();
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [testToEdit, setTestToEdit] = useState<any>(null);
  const [testToDelete, setTestToDelete] = useState<{id: string, name: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tests')
      .select('*')
      .order('name', { ascending: true });
    
    if (!error && data) {
      setTests(data);
    }
    setLoading(false);
  };

  const handleOpenEdit = (test: any) => {
    setTestToEdit(test);
    setIsModalOpen(true);
  };

  const handleOpenAdd = () => {
    setTestToEdit(null);
    setIsModalOpen(true);
  };

  const handleModalSuccess = () => {
    setIsModalOpen(false);
    fetchTests(); // Refresh list
  };

  const handleDeleteTest = (id: string, name: string) => {
    setTestToDelete({ id, name });
  };

  const confirmDeleteTest = async () => {
    if (!testToDelete) return;

    setIsDeleting(true);
    const { error } = await supabase.from('tests').delete().eq('id', testToDelete.id);
    
    if (error) {
      showError('Delete Failed', `Error deleting test: ${error.message}`);
    } else {
      await fetchTests();
    }
    
    setIsDeleting(false);
    setTestToDelete(null);
  };

  const filteredTests = tests.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Diagnotic Tests</h1>
          <p className="text-slate-500 text-sm mt-1">Manage tests, prices, and allowed discounts.</p>
        </div>
        <Button 
          onClick={handleOpenAdd}
          leftIcon={<Plus className="w-4 h-4" />}
          className="shadow-lg shadow-primary-500/30"
        >
          Add New Test
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available Tests</CardTitle>
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search tests..." 
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
                  <th className="px-6 py-4 font-semibold">Test Name</th>
                  <th className="px-6 py-4 font-semibold text-right">Price</th>
                  <th className="px-6 py-4 font-semibold text-center">Max Discount</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      Loading tests...
                    </td>
                  </tr>
                ) : filteredTests.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      No tests found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredTests.map((test) => (
                    <tr key={test.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4 border-b border-slate-100">
                        <p className="font-medium text-slate-900">{test.name}</p>
                      </td>
                      <td className="px-6 py-4 border-b border-slate-100 text-right font-medium text-slate-700">
                        ৳{test.price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 border-b border-slate-100 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary-50 text-secondary-700 border border-secondary-200">
                          {test.discount_percentage}%
                        </span>
                      </td>
                      <td className="px-6 py-4 border-b border-slate-100 text-right">
                        <div className="flex justify-end items-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(test)}
                            className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Test"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTest(test.id, test.name)}
                            className="p-2 text-slate-400 hover:text-error-600 hover:bg-error-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Test"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
        <TestModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={handleModalSuccess}
          testToEdit={testToEdit}
        />
      )}

      <ConfirmModal
        isOpen={testToDelete !== null}
        onClose={() => setTestToDelete(null)}
        onConfirm={confirmDeleteTest}
        title="Delete Diagnostic Test"
        message={`Are you sure you want to delete the test "${testToDelete?.name}"?\n\nThis action cannot be undone. Past bills holding this test will remain unchanged.`}
        confirmText="Delete Test"
        cancelText="Cancel"
        type="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
