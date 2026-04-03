import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { getTicketsByArticle } from '@/lib/bikedesk';
import { ensureCykelPlusSchemaReady } from '@/lib/cykelplus-schema';

interface Props {
  params: Promise<{ id: string }>;
}

const CACHE_TTL_HOURS = 24;

export async function GET(req: NextRequest, { params }: Props) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

    await ensureCykelPlusSchemaReady('app');

    const { id: bikeId } = await params;
    const supabase = await createServiceClient();

    const { data: bike } = await supabase
      .from('bikes')
      .select('id, bikedesk_article_id')
      .eq('id', bikeId)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (!bike) return NextResponse.json({ error: 'Cykel ikke fundet' }, { status: 404 });

    const { data: cached } = await supabase
      .from('bike_history_cache')
      .select('*')
      .eq('bike_id', bikeId)
      .order('completed_at', { ascending: false });

    const cacheAge =
      cached && cached.length > 0
        ? (Date.now() - new Date(cached[0].cached_at).getTime()) / 3600000
        : Infinity;

    if (cacheAge < CACHE_TTL_HOURS) {
      return NextResponse.json({ history: cached, source: 'cache' });
    }

    if (!bike.bikedesk_article_id) {
      return NextResponse.json({ history: cached ?? [], source: 'cache' });
    }

    try {
      const tickets = await getTicketsByArticle(bike.bikedesk_article_id);
      const now = new Date().toISOString();

      const entries = tickets.map((ticket) => ({
        bike_id: bikeId,
        entry_type: ticket.type === 'service' ? 'service' : 'repair',
        bikedesk_ticket_id: ticket.id,
        title: ticket.description?.split('\n')[0]?.trim() || `Opgave #${ticket.id}`,
        description: ticket.description ?? null,
        completed_at: ticket.pickup ?? null,
        workshop: null,
        cached_at: now,
      }));

      await supabase.from('bike_history_cache').delete().eq('bike_id', bikeId);
      if (entries.length > 0) {
        await supabase.from('bike_history_cache').insert(entries);
      }

      const { data: fresh } = await supabase
        .from('bike_history_cache')
        .select('*')
        .eq('bike_id', bikeId)
        .order('completed_at', { ascending: false });

      return NextResponse.json({ history: fresh ?? [], source: 'bikedesk' });
    } catch {
      return NextResponse.json({ history: cached ?? [], source: 'cache' });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fejl';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
