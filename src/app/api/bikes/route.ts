import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createBikeSchema = z.object({
  brand: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  frame_number: z.string().optional(),
  color: z.string().optional(),
  type: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('bikes')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bikes: data });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  try {
    const body = await req.json();
    const data = createBikeSchema.parse(body);
    const supabase = await createServiceClient();

    const { data: bike, error } = await supabase
      .from('bikes')
      .insert({ ...data, user_id: session.user.id })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ bike });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Fejl';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
