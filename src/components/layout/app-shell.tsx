'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SWRConfig } from 'swr';
import { BottomNav } from '@/components/layout/bottom-nav';
import { preloadMainTabData } from '@/hooks/use-app-data';
import { SESSION_API_KEY } from '@/lib/api-keys';
import type { SessionPayload } from '@/types';

interface AppShellProps {
  children: React.ReactNode;
  initialSessionPayload: SessionPayload;
}

export function AppShell({ children, initialSessionPayload }: AppShellProps) {
  const router = useRouter();

  useEffect(() => {
    const warmApp = () => {
      preloadMainTabData();
      router.prefetch('/home');
      router.prefetch('/garage');
      router.prefetch('/book');
      router.prefetch('/profile');
    };

    const browserWindow = window as Window &
      typeof globalThis & {
        requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
        cancelIdleCallback?: (handle: number) => void;
      };

    if (browserWindow.requestIdleCallback && browserWindow.cancelIdleCallback) {
      const idleId = browserWindow.requestIdleCallback(warmApp, { timeout: 1200 });
      return () => browserWindow.cancelIdleCallback?.(idleId);
    }

    const timeoutId = browserWindow.setTimeout(warmApp, 250);
    return () => browserWindow.clearTimeout(timeoutId);
  }, [router]);

  return (
    <SWRConfig
      value={{
        fallback: {
          [SESSION_API_KEY]: initialSessionPayload,
        },
      }}
    >
      <div className="relative mx-auto flex min-h-svh w-full max-w-[430px] flex-col bg-[var(--app-background)]">
        <main className="flex-1">{children}</main>
        <BottomNav />
      </div>
    </SWRConfig>
  );
}
