'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  backHref?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, backHref, action, className = '' }: PageHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  return (
    <header
      className={[
        'flex items-center gap-3 px-4 py-4 safe-top',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {backHref !== undefined && (
        <button
          onClick={handleBack}
          className="flex h-10 w-10 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 active:bg-gray-200 touch-manipulation"
          aria-label="Tilbage"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      <h1 className="flex-1 text-xl font-semibold text-gray-900">{title}</h1>
      {action && <div>{action}</div>}
    </header>
  );
}
