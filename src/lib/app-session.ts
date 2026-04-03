import type { AppSession, AppShellSession } from '@/types';

function getGreetingName(session: AppSession): string {
  return session.profile?.first_name?.trim() || session.profile?.last_name?.trim() || 'der';
}

function getInitials(session: AppSession): string {
  const nameParts = [session.profile?.first_name, session.profile?.last_name]
    .map((value) => value?.trim())
    .filter(Boolean) as string[];

  if (nameParts.length === 0) {
    return session.user.phone.replace(/\D/g, '').slice(-2).padStart(2, '0');
  }

  return nameParts
    .slice(0, 2)
    .map((value) => value[0]?.toUpperCase() ?? '')
    .join('');
}

export function toAppShellSession(session: AppSession): AppShellSession {
  return {
    session,
    greetingName: getGreetingName(session),
    initials: getInitials(session),
  };
}
