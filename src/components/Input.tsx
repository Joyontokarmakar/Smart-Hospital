import React, { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftIcon, className = '', type = 'text', ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    
    const isPasswordType = type === 'password';
    const inputType = isPasswordType && showPassword ? 'text' : type;

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            type={inputType}
            className={`
              appearance-none block w-full py-2.5 
              ${leftIcon ? 'pl-10' : 'pl-3'} ${isPasswordType ? 'pr-10' : 'pr-3'} 
              border rounded-xl shadow-sm 
              placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent 
              transition-all duration-200 bg-white/50 focus:bg-white
              ${error ? 'border-error-300 focus:ring-error-500' : 'border-slate-200'}
              ${className}
            `}
            {...props}
          />
          {isPasswordType && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
        </div>
        {error && (
          <p className="mt-1 text-sm text-error-600 animate-slide-down">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
