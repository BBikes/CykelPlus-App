'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Bell, User, Phone } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// This page is a client component so it can handle logout interactively
// Profile data is loaded via the /api/auth/me endpoint
import { useEffect } from 'react';
import type { AppSession } from '@/types';

export default function ProfilePage() {
  const router = useRouter();
  const [session, setSession] = useState<AppSession | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => setSession(data.session ?? null))
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    startTransition(async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.replace('/login');
    });
  };

  const fullName =
    [session?.profile?.first_name, session?.profile?.last_name].filter(Boolean).join(' ') ||
    'Ikke angivet';

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 page-bottom-padding safe-top">
      <h1 className="text-2xl font-bold text-gray-900">Profil</h1>

      {/* User info */}
      <Card padding="none" className="overflow-hidden divide-y divide-gray-100">
        <div className="flex items-center gap-4 px-4 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
            <User className="h-5 w-5 text-gray-500" />
          </div>
          <div>
            <p className="font-medium text-gray-900">{fullName}</p>
            <p className="text-sm text-gray-500">Navn</p>
          </div>
        </div>
        <div className="flex items-center gap-4 px-4 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
            <Phone className="h-5 w-5 text-gray-500" />
          </div>
          <div>
            <p className="font-medium text-gray-900">
              {session?.user.phone ?? '—'}
            </p>
            <p className="text-sm text-gray-500">Mobilnummer</p>
          </div>
        </div>
        <div className="flex items-center gap-4 px-4 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
            <Bell className="h-5 w-5 text-gray-500" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900">SMS-påmindelser</p>
            <p className="text-sm text-gray-500">
              {session?.profile?.sms_reminders ? 'Slået til' : 'Slået fra'}
            </p>
          </div>
        </div>
      </Card>

      {/* Logout */}
      <Button
        variant="danger"
        size="md"
        fullWidth
        loading={isPending}
        onClick={handleLogout}
      >
        <LogOut className="h-5 w-5" />
        Log ud
      </Button>

      <p className="text-center text-xs text-gray-400">CykelPlus · B-Bikes</p>
    </div>
  );
}
