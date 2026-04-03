import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { getUserBike } from '@/lib/app-bikes';
import { createCustomer, createCustomerArticle, findCustomerByPhone, updateCustomer, updateCustomerArticle } from '@/lib/bikedesk';
import { ensureCykelPlusSchemaReady } from '@/lib/cykelplus-schema';
import type { AppSession, Bike, BikedeskCustomer } from '@/types';
import { toDanishPhone } from '@/lib/twilio';

interface Props {
  params: Promise<{ id: string }>;
}

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

function buildBikeDeskTitle(bike: Pick<Bike, 'brand' | 'model'>): string {
  return `${bike.model?.trim() ?? ''} - ${bike.brand?.trim() ?? ''}`.trim();
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

export async function GET(_: Request, { params }: Props) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });
    }

    await ensureCykelPlusSchemaReady('auth');

    const { id } = await params;
    const bike = await getUserBike(session.user.id, id);
    if (!bike) {
      return NextResponse.json({ error: 'Cykel ikke fundet' }, { status: 404 });
    }

    return NextResponse.json({ bike });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fejl';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Props) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });
    }

    await ensureCykelPlusSchemaReady('auth');

    const { id } = await params;
    const payload = bikeSchema.parse(await req.json());
    const supabase = await createServiceClient();

    const { data: bikeRow } = await supabase
      .from('bikes')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    const bike = bikeRow as Bike | null;
    if (!bike) {
      return NextResponse.json({ error: 'Cykel ikke fundet' }, { status: 404 });
    }

    const customer = await ensureBikeDeskCustomer(session);

    let articleId = bike.bikedesk_article_id;
    const bikeDeskTitle = buildBikeDeskTitle({ brand: payload.brand, model: payload.model });
    const serialNumber = payload.frame_number || bike.frame_number || buildSerialNumber();

    if (articleId) {
      await updateCustomerArticle(articleId, {
        title: bikeDeskTitle,
        serieno: serialNumber,
        color: payload.color ?? undefined,
      });
    } else {
      const article = await createCustomerArticle(customer.id, {
        title: bikeDeskTitle,
        serieno: serialNumber,
        color: payload.color ?? undefined,
      });
      articleId = article.id;
    }

    const { data: updatedBike, error } = await supabase
      .from('bikes')
      .update({
        bikedesk_article_id: articleId,
        brand: payload.brand,
        model: payload.model,
        year: payload.year ?? null,
        frame_number: serialNumber,
        color: payload.color ?? null,
        type: payload.type ?? null,
        notes: payload.notes ?? null,
      })
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ bike: updatedBike });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fejl';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
