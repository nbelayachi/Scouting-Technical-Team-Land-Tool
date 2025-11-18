import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    variant?: 'primary' | 'secondary';
}

export const Button = ({ children, className = '', variant = 'primary', ...props }: ButtonProps) => {
    const baseClasses = 'flex items-center justify-center gap-2 px-6 py-3 font-semibold rounded-lg shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed';

    const variantClasses = {
        primary: 'bg-green-600 text-white hover:bg-green-500 focus:ring-green-500 disabled:bg-green-700',
        secondary: 'bg-slate-700 text-slate-200 hover:bg-slate-600 focus:ring-slate-500 disabled:bg-slate-800'
    };
    
    return (
        <button
            className={`${baseClasses} ${variantClasses[variant]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};