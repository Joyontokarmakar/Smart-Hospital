import { Button } from './Button';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel',
  type = 'danger',
  isLoading = false
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={isLoading ? undefined : onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl z-10 animate-fade-in-up">
        {/* Header styling based on type */}
        <div className={`px-6 py-4 border-b border-slate-100 rounded-t-2xl ${
          type === 'danger' ? 'bg-error-50 text-error-800' :
          type === 'warning' ? 'bg-warning-50 text-warning-800' :
          'bg-primary-50 text-primary-800'
        }`}>
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        
        <div className="px-6 py-5">
          <p className="text-slate-600 leading-relaxed text-sm whitespace-pre-line">{message}</p>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 rounded-b-2xl flex justify-end gap-3">
          <Button 
            variant="ghost" 
            onClick={onClose} 
            disabled={isLoading}
            className="text-slate-600 hover:text-slate-900"
          >
            {cancelText}
          </Button>
          <Button 
            onClick={onConfirm} 
            isLoading={isLoading}
            className={`shadow-md ${
              type === 'danger' ? 'bg-error-600 hover:bg-error-700 focus:ring-error-500 shadow-error-500/20' :
              type === 'warning' ? 'bg-warning-600 hover:bg-warning-700 focus:ring-warning-500 shadow-warning-500/20' :
              ''
            }`}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
