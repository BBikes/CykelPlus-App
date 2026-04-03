'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, LogOut } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AppSession } from '@/types';

interface ProfileFormProps {
  session: AppSession;
}

export function ProfileForm({ session }: ProfileFormProps) {
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
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Kunne ikke gemme profilen');
      }

      router.refresh();
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
    <form onSubmit={handleSave} className="flex flex-col gap-5 px-4 pt-6 page-bottom-padding safe-top">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profil</h1>
        <p className="mt-1 text-sm text-gray-500">
          Oplysningerne skrives tilbage til BikeDesk og bliver brugt i hele appen.
        </p>
      </div>

      <Card className="flex flex-col gap-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
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
          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
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

        <label className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
              <Bell className="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <p className="font-medium text-gray-900">SMS-paamindelser</p>
              <p className="text-sm text-gray-500">Fa besked om booking og serviceforloeb</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={form.sms_reminders}
            onChange={(event) =>
              setForm((current) => ({ ...current, sms_reminders: event.target.checked }))
            }
            className="h-5 w-5 rounded border-gray-300"
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
  );
}
