import { Skeleton } from '@/components/ui/skeleton';

export function AppShellLoading() {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[430px] flex-col bg-[var(--app-background)]">
      <div className="flex-1 px-4 pt-6">
        <HomeTabSkeleton />
      </div>
      <div className="border-t border-white/70 bg-white/90 px-5 py-3">
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex flex-col items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-2.5 w-10 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HomeTabSkeleton() {
  return (
    <div className="flex flex-col gap-5 pb-24 pt-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36 rounded-full" />
          <Skeleton className="h-4 w-28 rounded-full" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-12 rounded-full" />
          <Skeleton className="h-12 w-12 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-56 w-full rounded-[28px]" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 w-full rounded-[24px]" />
        ))}
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-4 w-12 rounded-full" />
        </div>
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-[24px]" />
        ))}
      </div>
    </div>
  );
}

export function GarageTabSkeleton() {
  return (
    <div className="flex flex-col gap-5 pb-24 pt-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32 rounded-full" />
        <Skeleton className="h-12 w-28 rounded-2xl" />
      </div>
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-28 w-full rounded-[24px]" />
      ))}
    </div>
  );
}

export function ServiceTabSkeleton() {
  return (
    <div className="flex flex-col gap-5 pb-24 pt-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
      <Skeleton className="h-8 w-40 rounded-full" />
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-1.5 w-full rounded-full" />
        ))}
      </div>
      {Array.from({ length: 2 }).map((_, index) => (
        <Skeleton key={index} className="h-28 w-full rounded-[24px]" />
      ))}
      <Skeleton className="h-14 w-full rounded-2xl" />
    </div>
  );
}

export function ProfileTabSkeleton() {
  return (
    <div className="flex flex-col gap-5 pb-24 pt-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-32 rounded-full" />
          <Skeleton className="h-4 w-24 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-[72px] w-full rounded-[24px]" />
        ))}
      </div>
      <Skeleton className="h-96 w-full rounded-[28px]" />
    </div>
  );
}

export function BookingsPageSkeleton() {
  return (
    <div className="flex flex-col gap-4 pb-24 pt-6">
      <Skeleton className="h-8 w-32 rounded-full" />
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-28 w-full rounded-[24px]" />
      ))}
    </div>
  );
}
