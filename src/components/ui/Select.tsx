import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}

const Select: React.FC<SelectProps> = ({ label, id, children, className = '', ...props }) => {
  return (
    <div className="w-full">
      <label htmlFor={id} className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          className={`
            w-full px-4 py-2.5 
            bg-white border border-gray-300 rounded-lg 
            text-gray-900 placeholder-gray-400 
            appearance-none
            transition-all duration-200 ease-in-out
            focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 
            hover:border-gray-400
            shadow-sm
            cursor-pointer
            ${className}
          `}
          {...props}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default Select;
