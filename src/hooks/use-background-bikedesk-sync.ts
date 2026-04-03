'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { mutate } from 'swr';
import { SESSION_API_KEY } from '@/lib/api-keys';
import { fetchJson } from '@/lib/http';
import type { SessionPayload, SyncMeta } from '@/types';

interface BackgroundSyncOptions {
  requireBikes?: boolean;
  requireBookings?: boolean;
  revalidateKeys?: string[];
}

export function useBackgroundBikedeskSync(
  sync: SyncMeta | undefined,
  options: BackgroundSyncOptions = {}
) {
  const [isSyncing, setIsSyncing] = useState(false);
  const syncSignatureRef = useRef<string | null>(null);

  const refreshAfterSync = useEffectEvent(async () => {
    const keys = [...new Set([SESSION_API_KEY, ...(options.revalidateKeys ?? [])])];
    await Promise.all(keys.map((key) => mutate(key)));
  });

  const runSync = useEffectEvent(async (force = false) => {
    setIsSyncing(true);
    try {
      const response = await fetchJson<SessionPayload>('/api/sync/bikedesk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requireBikes: options.requireBikes ?? false,
          requireBookings: options.requireBookings ?? false,
          force,
        }),
      });

      await mutate(SESSION_API_KEY, response, { revalidate: false });
      await refreshAfterSync();
    } finally {
      setIsSyncing(false);
    }
  });

  useEffect(() => {
    if (!sync?.syncRecommended) {
      syncSignatureRef.current = null;
      return;
    }

    const signature = `${sync.lastSyncedAt ?? 'never'}:${options.requireBikes ? 'b' : ''}:${options.requireBookings ? 'k' : ''}`;
    if (syncSignatureRef.current === signature) {
      return;
    }

    syncSignatureRef.current = signature;
    void runSync(false);
  }, [
    options.requireBikes,
    options.requireBookings,
    runSync,
    sync?.lastSyncedAt,
    sync?.syncRecommended,
  ]);

  return {
    isSyncing: isSyncing || sync?.syncing === true,
    triggerSync(force = true) {
      syncSignatureRef.current = null;
      return runSync(force);
    },
  };
}
