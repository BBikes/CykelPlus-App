import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, className = '', id, ...props },
  ref
) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-600">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={[
          'w-full rounded-2xl border px-4 py-3.5 text-slate-900 placeholder:text-slate-400',
          'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent',
          'transition-colors',
          error ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white/95',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {hint && !error && <p className="text-sm text-slate-500">{hint}</p>}
    </div>
  );
});
