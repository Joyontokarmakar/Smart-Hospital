import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftIcon, className = '', ...props }, ref) => {
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
            className={`
              appearance-none block w-full py-2.5 
              ${leftIcon ? 'pl-10' : 'pl-3'} pr-3 
              border rounded-xl shadow-sm 
              placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent 
              transition-all duration-200 bg-white/50 focus:bg-white
              ${error ? 'border-error-300 focus:ring-error-500' : 'border-slate-200'}
              ${className}
            `}
            {...props}
          />
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
