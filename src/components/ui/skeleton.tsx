'use client';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={['animate-pulse rounded-2xl bg-slate-200/80', className].filter(Boolean).join(' ')}
      aria-hidden="true"
    />
  );
}
