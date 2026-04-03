import { forwardRef } from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'sm' | 'md' | 'lg' | 'none';
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { padding = 'md', className = '', children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={['rounded-2xl bg-white shadow-sm', paddingClasses[padding], className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </div>
  );
});
