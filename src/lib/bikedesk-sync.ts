import { createServiceClient } from '@/lib/supabase/server';
import { getBikedeskTicketDisplayNumber, normalizeSharedBookingStatus } from '@/lib/bikedesk-status';
import {
  findCustomerByPhone,
  getCustomerArticles,
  getTags,
  getTicketsByArticle,
} from '@/lib/bikedesk';
import { supportsBookingExtensions } from '@/lib/booking-schema';
import type {
  AppSession,
  AppUser,
  Bike,
  BikedeskCustomer,
  BikedeskCustomerArticle,
  BikedeskTag,
  BikedeskTicket,
  Booking,
  BookingMethod,
  SharedBookingStatus,
  SyncMeta,
} from '@/types';
import { CYKELPLUS_BOOKING_FORM_SLUG } from './booking-context';
import { ensureCykelPlusSchemaReady } from './cykelplus-schema';

const SYNC_WINDOW_MS = 15 * 60 * 1000;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export interface BikeDeskSyncOptions {
  requireBikes?: boolean;
  requireBookings?: boolean;
  force?: boolean;
}

function splitName(name: string): { firstName: string | null; lastName: string | null } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? null,
    lastName: parts.slice(1).join(' ') || null,
  };
}

function parseBikeDeskArticle(article: BikedeskCustomerArticle): Pick<
  Bike,
  'brand' | 'model' | 'frame_number' | 'color'
> {
  const parts = article.title.split(' - ').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      model: parts[0] ?? article.title,
      brand: parts.slice(1).join(' - ') || null,
      frame_number: article.serieno || null,
      color: article.color ?? null,
    };
  }

  return {
    brand: null,
    model: article.title || null,
    frame_number: article.serieno || null,
    color: article.color ?? null,
  };
}

function inferMethodFromTicket(ticket: BikedeskTicket, tagMap: Map<number, string>): BookingMethod {
  const labels = (ticket.tagids ?? [])
    .map((tagId) => tagMap.get(tagId)?.toLowerCase() ?? '')
    .filter(Boolean);

  if (labels.some((label) => label.includes('hent') || label.includes('pickup'))) {
    return 'pickup';
  }

  if (
    labels.some(
      (label) =>
        label.includes('arbejdsplads') ||
        label.includes('onsite') ||
        label.includes('arbejde')
    )
  ) {
    return 'onsite';
  }

  return 'drop_off';
}

function extractDate(dateTime: string | null | undefined): string {
  if (!dateTime) return new Date().toISOString().slice(0, 10);
  return dateTime.slice(0, 10);
}

function extractTime(dateTime: string | null | undefined): string | null {
  if (!dateTime || !dateTime.includes('T')) return null;
  return dateTime.slice(11, 16);
}

function shouldSyncTicket(ticket: BikedeskTicket): boolean {
  const normalized = normalizeSharedBookingStatus(ticket.status);
  if (normalized !== 'done') return true;

  const reference = ticket.pickup || ticket.startTime;
  if (!reference) return true;

  return Date.now() - new Date(reference).getTime() <= ONE_YEAR_MS;
}

async function upsertUserProfile(
  userId: string,
  customer: BikedeskCustomer
): Promise<void> {
  const supabase = await createServiceClient();
  const { firstName, lastName } = splitName(customer.name);

  await supabase.from('user_profiles').upsert(
    {
      id: userId,
      first_name: firstName,
      last_name: lastName,
      email: customer.email || null,
      address: customer.address || null,
      city: customer.city || null,
      zip: customer.zipcode || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
}

async function syncBikesForCustomer(
  userId: string,
  customerId: number
): Promise<Map<number, Bike>> {
  const supabase = await createServiceClient();
  const [{ data: existingBikes }, articles] = await Promise.all([
    supabase.from('bikes').select('*').eq('user_id', userId),
    getCustomerArticles(customerId),
  ]);

  const bikeMap = new Map<number, Bike>();
  const existingByArticleId = new Map(
    ((existingBikes ?? []) as Bike[])
      .filter((bike) => typeof bike.bikedesk_article_id === 'number')
      .map((bike) => [bike.bikedesk_article_id as number, bike])
  );

  for (const article of articles) {
    const parsed = parseBikeDeskArticle(article);
    const existing = existingByArticleId.get(article.id);

    if (existing) {
      const { data: updated } = await supabase
        .from('bikes')
        .update({
          brand: parsed.brand,
          model: parsed.model,
          frame_number: parsed.frame_number,
          color: parsed.color,
        })
        .eq('id', existing.id)
        .select('*')
        .single();

      bikeMap.set(article.id, (updated ?? existing) as Bike);
      continue;
    }

    const { data: inserted } = await supabase
      .from('bikes')
      .insert({
        user_id: userId,
        bikedesk_article_id: article.id,
        brand: parsed.brand,
        model: parsed.model,
        frame_number: parsed.frame_number,
        color: parsed.color,
      })
      .select('*')
      .single();

    if (inserted) {
      bikeMap.set(article.id, inserted as Bike);
    }
  }

  return bikeMap;
}

async function getCykelPlusFormId(): Promise<string | null> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from('booking_forms')
    .select('id')
    .eq('slug', CYKELPLUS_BOOKING_FORM_SLUG)
    .maybeSingle();

  return data?.id ?? null;
}

async function syncBookingsForCustomer(
  user: AppUser,
  customer: BikedeskCustomer,
  bikesByArticleId: Map<number, Bike>
): Promise<void> {
  const supabase = await createServiceClient();
  const [tags, formId, extensionsSupported] = await Promise.all([
    getTags(),
    getCykelPlusFormId(),
    supportsBookingExtensions(),
  ]);
  const tagMap = new Map((tags as BikedeskTag[]).map((tag) => [tag.id, tag.label]));
  const ticketsByArticle = await Promise.all(
    [...bikesByArticleId.keys()].map(async (articleId) => ({
      articleId,
      tickets: (await getTicketsByArticle(articleId)).filter(shouldSyncTicket),
    }))
  );

  const tickets = ticketsByArticle.flatMap(({ articleId, tickets: articleTickets }) =>
    articleTickets.map((ticket) => ({ articleId, ticket }))
  );

  if (tickets.length === 0) return;

  const ticketIds = tickets.map(({ ticket }) => ticket.id);
  const { data: existingRows } = await supabase
    .from('bookings')
    .select('*')
    .in('bikedesk_ticket_id', ticketIds);

  const existingByTicketId = new Map(
    ((existingRows ?? []) as Booking[]).map((booking) => [booking.bikedesk_ticket_id ?? -1, booking])
  );

  for (const { articleId, ticket } of tickets) {
    const bike = bikesByArticleId.get(articleId);
    if (!bike) continue;

    const existing = existingByTicketId.get(ticket.id);
    const normalizedStatus: SharedBookingStatus = normalizeSharedBookingStatus(ticket.status);
    const method = inferMethodFromTicket(ticket, tagMap);
    const basePayload = {
      form_id: existing?.form_id ?? formId,
      service_ids: existing?.service_ids ?? [],
      addon_ids: existing?.addon_ids ?? [],
      method,
      date: extractDate(ticket.startTime || ticket.pickup),
      time: extractTime(ticket.startTime),
      status: normalizedStatus,
      notes: existing?.notes ?? ticket.description ?? null,
      budget_limit: existing?.budget_limit ?? null,
      bikedesk_ticket_cardno:
        getBikedeskTicketDisplayNumber(ticket) ?? existing?.bikedesk_ticket_cardno ?? null,
      customer_data: {
        name: customer.name,
        phone: user.phone,
        email: customer.email,
        address: customer.address,
        zip_code: customer.zipcode,
        city: customer.city,
        bikedesk_id: customer.id,
      },
      bike_data: {
        brand: bike.brand ?? '',
        model: bike.model ?? '',
        type: bike.type ?? '',
        frame_number: bike.frame_number ?? undefined,
        bikedesk_article_id: articleId,
        is_new: false,
      },
      bikedesk_ticket_id: ticket.id,
      updated_at: new Date().toISOString(),
    };
    const payload = extensionsSupported
      ? {
          ...basePayload,
          user_id: user.id,
          bike_id: bike.id,
          payment_link_url: existing?.payment_link_url ?? null,
          payment_expires_at: existing?.payment_expires_at ?? null,
        }
      : basePayload;

    if (existing) {
      await supabase.from('bookings').update(payload).eq('id', existing.id);
      continue;
    }

    await supabase.from('bookings').insert(payload);
  }
}

export async function syncUserFromBikedesk(user: AppUser): Promise<void> {
  await ensureCykelPlusSchemaReady('auth');

  const supabase = await createServiceClient();
  const customer = await findCustomerByPhone(user.phone);
  const now = new Date().toISOString();

  if (!customer) {
    await supabase
      .from('users')
      .update({ last_bikedesk_sync_at: now })
      .eq('id', user.id);
    return;
  }

  await supabase
    .from('users')
    .update({
      bikedesk_customer_id: customer.id,
      last_bikedesk_sync_at: now,
    })
    .eq('id', user.id);

  await upsertUserProfile(user.id, customer);
  const bikesByArticleId = await syncBikesForCustomer(user.id, customer.id);
  await syncBookingsForCustomer(
    {
      ...user,
      bikedesk_customer_id: customer.id,
      last_bikedesk_sync_at: now,
    },
    customer,
    bikesByArticleId
  );
}

async function getRequiredDataResults(
  user: AppUser,
  options: BikeDeskSyncOptions
): Promise<Array<{ count: number | null }>> {
  const supabase = await createServiceClient();
  const extensionsSupported = await supportsBookingExtensions();

  const checks: Array<Promise<{ count: number | null }>> = [];
  if (options.requireBikes) {
    checks.push(
      (async () => {
        const { count } = await supabase
          .from('bikes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);
        return { count };
      })()
    );
  }
  if (options.requireBookings) {
    checks.push(
      (async () => {
        const query = supabase.from('bookings').select('*', { count: 'exact', head: true });
        const { count } = await (extensionsSupported
          ? query.eq('user_id', user.id)
          : query.eq('customer_data->>phone', user.phone));
        return { count };
      })()
    );
  }

  return Promise.all(checks);
}

export async function getBikeDeskSyncMeta(
  session: AppSession,
  options: BikeDeskSyncOptions = {}
): Promise<SyncMeta> {
  await ensureCykelPlusSchemaReady('auth');

  const user = session.user;
  const lastSyncAt = user.last_bikedesk_sync_at ? new Date(user.last_bikedesk_sync_at).getTime() : 0;
  const isStale = !lastSyncAt || Date.now() - lastSyncAt > SYNC_WINDOW_MS;
  const results = await getRequiredDataResults(user, options);
  const missingRequiredData = results.some((result) => (result.count ?? 0) === 0);

  return {
    lastSyncedAt: user.last_bikedesk_sync_at,
    syncRecommended: Boolean(options.force || isStale || missingRequiredData),
    syncing: false,
  };
}

export async function ensureBikeDeskSync(
  session: AppSession,
  options: BikeDeskSyncOptions = {}
): Promise<void> {
  const user = session.user;
  const syncMeta = await getBikeDeskSyncMeta(session, options);

  if (!syncMeta.syncRecommended) {
    return;
  }

  await syncUserFromBikedesk(user);
}
