import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { supabase } from '../lib/supabase';

interface TestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  testToEdit?: any; // Will type properly if we had types for tests locally
}

export function TestModal({ isOpen, onClose, onSuccess, testToEdit }: TestModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: testToEdit?.name || '',
    price: testToEdit?.price || '',
    discount_percentage: testToEdit?.discount_percentage || 0,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (testToEdit) {
        // Update
        const { error: updateError } = await supabase
          .from('tests')
          .update({
            name: formData.name,
            price: parseFloat(formData.price as string),
            discount_percentage: parseFloat(formData.discount_percentage as string),
            updated_at: new Date().toISOString(),
          })
          .eq('id', testToEdit.id);

        if (updateError) throw updateError;
      } else {
        // Insert
        const { error: insertError } = await supabase
          .from('tests')
          .insert({
            name: formData.name,
            price: parseFloat(formData.price as string),
            discount_percentage: parseFloat(formData.discount_percentage as string) || 0,
          });

        if (insertError) throw insertError;
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={testToEdit ? 'Edit Test' : 'Add New Test'}>
      {error && (
        <div className="mb-6 p-4 bg-error-50 text-error-700 rounded-xl border border-error-200 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input 
          label="Test Name" 
          name="name" 
          required 
          value={formData.name} 
          onChange={handleChange} 
          placeholder="e.g. Complete Blood Count (CBC)"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input 
            label="Price (৳/USD)" 
            name="price" 
            type="number"
            step="0.01"
            min="0"
            required 
            value={formData.price} 
            onChange={handleChange} 
            placeholder="0.00"
          />
          <Input 
            label="Maximum Discount (%)" 
            name="discount_percentage" 
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={formData.discount_percentage} 
            onChange={handleChange} 
            placeholder="0"
          />
        </div>

        <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-slate-100">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={loading}>
            {testToEdit ? 'Save Changes' : 'Create Test'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
