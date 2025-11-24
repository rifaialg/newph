import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

const Input: React.FC<InputProps> = ({ label, id, className = '', ...props }) => {
  return (
    <div className="w-full">
      <label htmlFor={id} className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label}
      </label>
      <input
        id={id}
        className={`
          w-full px-4 py-2.5 
          bg-white border border-gray-300 rounded-lg 
          text-gray-900 placeholder-gray-400 
          transition-all duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 
          hover:border-gray-400
          shadow-sm
          ${className}
        `}
        {...props}
      />
    </div>
  );
};

export default Input;
