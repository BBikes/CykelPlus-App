import { NextRequest, NextResponse } from 'next/server';
import { sendVerificationCode, toE164 } from '@/lib/twilio';
import { z } from 'zod';

const schema = z.object({
  phone: z.string().min(8),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone } = schema.parse(body);
    const e164 = toE164(phone);
    await sendVerificationCode(e164);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ukendt fejl';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
