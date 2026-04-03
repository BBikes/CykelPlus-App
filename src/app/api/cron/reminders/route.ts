import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendSms } from '@/lib/twilio';

// Called by Vercel cron: "0 9 * * 1" (Mondays at 09:00)
export async function GET() {
  const supabase = await createServiceClient();
  const today = new Date().toISOString().split('T')[0];

  // Find pending reminders due today or overdue
  const { data: reminders } = await supabase
    .from('service_reminders')
    .select(
      `
      *,
      bike:bikes(brand, model),
      user:users(phone),
      rule:service_reminder_rules(rule_name, sms_template)
    `
    )
    .eq('status', 'pending')
    .lte('due_date', today)
    .is('sent_at', null)
    .limit(100);

  if (!reminders || reminders.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  let sent = 0;
  for (const reminder of reminders) {
    try {
      const bikeName = [reminder.bike?.brand, reminder.bike?.model].filter(Boolean).join(' ');
      const body =
        reminder.rule?.sms_template?.replace('[bike_title]', bikeName) ??
        `Hej! Din cykel ${bikeName} er klar til service. Book tid på B-Bikes.dk eller i CykelPlus appen.`;

      await sendSms(reminder.user.phone, body);

      await supabase
        .from('service_reminders')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', reminder.id);

      sent++;
    } catch {
      // Non-fatal — continue with next
    }
  }

  return NextResponse.json({ ok: true, sent });
}
