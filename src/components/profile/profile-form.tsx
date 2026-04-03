'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CalendarClock, Headset, LogOut, RefreshCw } from 'lucide-react';
import { mutate } from 'swr';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BIKES_API_KEY, BOOKINGS_API_KEY, HOME_API_KEY, SESSION_API_KEY } from '@/lib/api-keys';
import type { AppSession, AppShellSession, SessionPayload } from '@/types';

interface ProfileFormProps {
  session: AppSession;
  viewer: AppShellSession;
  syncRecommended: boolean;
  syncInProgress: boolean;
  onRefreshData: () => Promise<unknown>;
}

export function ProfileForm({
  session,
  viewer,
  syncRecommended,
  syncInProgress,
  onRefreshData,
}: ProfileFormProps) {
  const router = useRouter();
  const [isLoggingOut, startLogoutTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    first_name: session.profile?.first_name ?? '',
    last_name: session.profile?.last_name ?? '',
    email: session.profile?.email ?? '',
    address: session.profile?.address ?? '',
    city: session.profile?.city ?? '',
    zip: session.profile?.zip ?? '',
    sms_reminders: session.profile?.sms_reminders ?? true,
  });

  async function revalidateRelatedData() {
    await Promise.all([
      mutate(HOME_API_KEY),
      mutate(BIKES_API_KEY),
      mutate(BOOKINGS_API_KEY),
      mutate(SESSION_API_KEY),
    ]);
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as SessionPayload | { error?: string };

      if (!res.ok || !('session' in data)) {
        throw new Error(
          data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
            ? data.error
            : 'Kunne ikke gemme profilen'
        );
      }

      await mutate(SESSION_API_KEY, data, { revalidate: false });
      await revalidateRelatedData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Ukendt fejl');
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    startLogoutTransition(async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.replace('/login');
    });
  }

  return (
    <div className="px-4 pb-24 pt-6">
      <div className="flex flex-col gap-5">
        <header className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 text-lg font-semibold text-white shadow-[0_20px_44px_-24px_rgba(15,23,42,0.95)]">
            {viewer.initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[2rem] font-semibold tracking-[-0.04em] text-slate-950">
                Profil
              </h1>
              {syncInProgress ? (
                <Badge variant="blue">Synkroniserer</Badge>
              ) : syncRecommended ? (
                <Badge variant="amber">Data skal opdateres</Badge>
              ) : (
                <Badge variant="green">Data er opdateret</Badge>
              )}
            </div>
            <p className="mt-2 text-sm text-slate-500">{session.user.phone}</p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Oplysningerne skrives tilbage til BikeDesk og bruges i hele appen.
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-3">
          <Link href="/bookings">
            <Card className="flex items-center justify-between rounded-[24px] px-4 py-4 transition-transform active:scale-[0.99]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                  <CalendarClock className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Mine Aftaler</p>
                  <p className="text-sm text-slate-500">Se aktuelle og tidligere bookinger</p>
                </div>
              </div>
            </Card>
          </Link>

          <Link href="/help">
            <Card className="flex items-center justify-between rounded-[24px] px-4 py-4 transition-transform active:scale-[0.99]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Headset className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Hjælp</p>
                  <p className="text-sm text-slate-500">Kontakt og ofte stillede spørgsmål</p>
                </div>
              </div>
            </Card>
          </Link>

          <button
            type="button"
            onClick={() => {
              void onRefreshData();
            }}
          >
            <Card className="flex w-full items-center justify-between rounded-[24px] px-4 py-4 text-left transition-transform active:scale-[0.99]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                  <RefreshCw className={['h-5 w-5', syncInProgress ? 'animate-spin' : ''].join(' ')} />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Opdater data</p>
                  <p className="text-sm text-slate-500">Hent de nyeste oplysninger fra BikeDesk</p>
                </div>
              </div>
            </Card>
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-5">
          <Card className="flex flex-col gap-4 rounded-[28px] p-5">
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Fornavn"
                value={form.first_name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, first_name: event.target.value }))
                }
              />
              <Input
                label="Efternavn"
                value={form.last_name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, last_name: event.target.value }))
                }
              />
            </div>

            <Input label="Mobilnummer" value={session.user.phone} disabled />

            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
            />

            <Input
              label="Adresse"
              value={form.address}
              onChange={(event) =>
                setForm((current) => ({ ...current, address: event.target.value }))
              }
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Postnummer"
                value={form.zip}
                onChange={(event) => setForm((current) => ({ ...current, zip: event.target.value }))}
              />
              <Input
                label="By"
                value={form.city}
                onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
              />
            </div>

            <label className="flex items-center justify-between gap-4 rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">SMS-påmindelser</p>
                  <p className="text-sm text-slate-500">
                    Få besked om booking og serviceforløb
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={form.sms_reminders}
                onChange={(event) =>
                  setForm((current) => ({ ...current, sms_reminders: event.target.checked }))
                }
                className="h-5 w-5 rounded border-slate-300"
              />
            </label>
          </Card>

          <Button type="submit" variant="primary" fullWidth loading={saving}>
            Gem profil
          </Button>

          <Button
            type="button"
            variant="danger"
            fullWidth
            loading={isLoggingOut}
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
            Log ud
          </Button>
        </form>
      </div>
    </div>
  );
}
