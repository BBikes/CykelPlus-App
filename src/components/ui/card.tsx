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
      className={[
        'rounded-[24px] border border-white/80 bg-white/95 shadow-[0_20px_50px_-32px_rgba(15,23,42,0.28)] backdrop-blur-sm',
        paddingClasses[padding],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </div>
  );
});
