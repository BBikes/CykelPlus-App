import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { getBikeDeskSyncMeta } from '@/lib/bikedesk-sync';
import { listUserBikes } from '@/lib/app-bikes';
import { createCustomer, createCustomerArticle, findCustomerByPhone, updateCustomer } from '@/lib/bikedesk';
import type { AppSession, BikedeskCustomer } from '@/types';
import { toDanishPhone } from '@/lib/twilio';

const bikeSchema = z.object({
  brand: z.string().trim().min(1, 'Mærke er påkrævet'),
  model: z.string().trim().min(1, 'Model er påkrævet'),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  frame_number: z.string().trim().nullable().optional(),
  color: z.string().trim().nullable().optional(),
  type: z.string().trim().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

function buildCustomerName(session: AppSession): string {
  return (
    [session.profile?.first_name, session.profile?.last_name].filter(Boolean).join(' ').trim() ||
    session.user.phone
  );
}

function buildBikeDeskTitle(brand: string, model: string): string {
  return `${model.trim()} - ${brand.trim()}`.trim();
}

function buildSerialNumber(): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Copenhagen',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});

  return `WEB-${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
}

async function ensureBikeDeskCustomer(session: AppSession): Promise<BikedeskCustomer> {
  const supabase = await createServiceClient();
  const profile = session.profile;
  const payload = {
    name: buildCustomerName(session),
    phone: toDanishPhone(session.user.phone),
    email: profile?.email ?? '',
    address: profile?.address ?? '',
    zipcode: profile?.zip ?? '',
    city: profile?.city ?? '',
  };

  let customer: BikedeskCustomer | null = null;

  if (session.user.bikedesk_customer_id) {
    try {
      customer = await updateCustomer(session.user.bikedesk_customer_id, payload);
    } catch {
      customer = null;
    }
  }

  if (!customer) {
    customer = await findCustomerByPhone(session.user.phone);
    if (customer) {
      customer = await updateCustomer(customer.id, payload);
    }
  }

  if (!customer) {
    customer = await createCustomer(payload);
  }

  await supabase
    .from('users')
    .update({
      bikedesk_customer_id: customer.id,
      last_bikedesk_sync_at: new Date().toISOString(),
    })
    .eq('id', session.user.id);

  return customer;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });
  }

  const [bikes, sync] = await Promise.all([
    listUserBikes(session.user.id),
    getBikeDeskSyncMeta(session, { requireBikes: true }),
  ]);
  return NextResponse.json({ bikes, sync });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });
  }

  try {
    const payload = bikeSchema.parse(await req.json());
    const [customer, supabase] = await Promise.all([
      ensureBikeDeskCustomer(session),
      createServiceClient(),
    ]);

    const article = await createCustomerArticle(customer.id, {
      title: buildBikeDeskTitle(payload.brand, payload.model),
      serieno: payload.frame_number || buildSerialNumber(),
      color: payload.color ?? undefined,
    });

    const { data: bike, error } = await supabase
      .from('bikes')
      .insert({
        user_id: session.user.id,
        bikedesk_article_id: article.id,
        brand: payload.brand,
        model: payload.model,
        year: payload.year ?? null,
        frame_number: payload.frame_number || article.serieno || null,
        color: payload.color ?? null,
        type: payload.type ?? null,
        notes: payload.notes ?? null,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ bike }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fejl';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
