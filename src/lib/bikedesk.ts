import type {
  BikedeskCustomer,
  BikedeskCustomerArticle,
  BikedeskStore,
  BikedeskTag,
  BikedeskTicket,
  BikedeskTicketTemplate,
  BikedeskTicketTemplateGroup,
  BikedeskUser,
} from '@/types';
import { getBikedeskAuthHeaders, getBikedeskBaseUrl } from './bikedesk-config';

const BASE_URL = getBikedeskBaseUrl();

type BikedeskTicketRecord = BikedeskTicket & Record<string, unknown>;
export interface BikedeskPaymentLink {
  url: string | null;
  expires_at: string | null;
  raw: Record<string, unknown> | null;
}

type BikedeskTicketTemplateMaterial = {
  price?: number;
  derivedprice?: number;
  amount?: number;
};
type WrappedResponse<T> = { content?: T } | T;

function unwrapResponse<T>(payload: WrappedResponse<T>): T {
  if (payload && typeof payload === 'object' && 'content' in payload) {
    return (payload as { content?: T }).content as T;
  }

  return payload as T;
}

async function bdFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...getBikedeskAuthHeaders(),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Bikedesk ${options.method ?? 'GET'} ${path} failed: ${res.status} ${body}`);
  }

  const payload = (await res.json()) as WrappedResponse<T>;
  return unwrapResponse(payload);
}

function buildPhoneVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, '');
  const variants = [phone, digits];

  if (digits.startsWith('45') && digits.length === 10) {
    variants.push(digits.slice(2));
  }

  return [...new Set(variants.filter(Boolean))];
}

function normalizeSearchValue(value: string): string {
  return value
    .replace(/æ/gi, 'ae')
    .replace(/ø/gi, 'oe')
    .replace(/å/gi, 'aa')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function readFirstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return null;
}

function normalizePaymentLinkPayload(payload: unknown): BikedeskPaymentLink {
  if (typeof payload === 'string' && payload.trim()) {
    return {
      url: payload,
      expires_at: null,
      raw: { value: payload },
    };
  }

  if (!payload || typeof payload !== 'object') {
    return {
      url: null,
      expires_at: null,
      raw: null,
    };
  }

  const raw = payload as Record<string, unknown>;
  const url =
    readFirstString(raw, ['url', 'link', 'href', 'paymentLink', 'payment_link', 'paymentlink']) ??
    (raw.content && typeof raw.content === 'object'
      ? readFirstString(raw.content as Record<string, unknown>, [
          'url',
          'link',
          'href',
          'paymentLink',
          'payment_link',
          'paymentlink',
        ])
      : null);
  const expiresAt =
    readFirstString(raw, ['expires_at', 'expiresAt', 'valid_until', 'validUntil']) ??
    (raw.content && typeof raw.content === 'object'
      ? readFirstString(raw.content as Record<string, unknown>, [
          'expires_at',
          'expiresAt',
          'valid_until',
          'validUntil',
        ])
      : null);

  return {
    url,
    expires_at: expiresAt,
    raw,
  };
}

export async function findCustomerByPhone(phone: string): Promise<BikedeskCustomer | null> {
  for (const variant of buildPhoneVariants(phone)) {
    const results = await bdFetch<BikedeskCustomer[]>(
      `/customers?phoneno=${encodeURIComponent(variant)}`
    );

    if (results?.length) {
      return results[0];
    }
  }

  return null;
}

export async function createCustomer(data: {
  name: string;
  phone: string;
  email: string;
  address: string;
  zipcode: string;
  city: string;
}): Promise<BikedeskCustomer> {
  return bdFetch<BikedeskCustomer>('/customers', {
    method: 'POST',
    body: JSON.stringify({ content: data }),
  });
}

export async function updateCustomer(
  id: number,
  data: Partial<Pick<BikedeskCustomer, 'name' | 'phone' | 'email' | 'address' | 'zipcode' | 'city'>>
): Promise<BikedeskCustomer> {
  const current = await bdFetch<BikedeskCustomer>(`/customers/${id}`);
  return bdFetch<BikedeskCustomer>(`/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      content: {
        id: current.id,
        name: data.name ?? current.name,
        phone: data.phone ?? current.phone,
        email: data.email ?? current.email,
        address: data.address ?? current.address,
        zipcode: data.zipcode ?? current.zipcode,
        city: data.city ?? current.city,
      },
    }),
  });
}

export async function getCustomerArticles(customerId: number): Promise<BikedeskCustomerArticle[]> {
  return bdFetch<BikedeskCustomerArticle[]>(`/customerarticles?customerid=${customerId}`);
}

export async function createCustomerArticle(
  customerId: number,
  data: { title: string; serieno: string; color?: string; size?: string }
): Promise<BikedeskCustomerArticle> {
  return bdFetch<BikedeskCustomerArticle>('/customerarticles', {
    method: 'POST',
    body: JSON.stringify({
      content: {
        customerid: customerId,
        ...data,
      },
    }),
  });
}

export async function updateCustomerArticle(
  articleId: number,
  data: Partial<Pick<BikedeskCustomerArticle, 'title' | 'serieno' | 'color' | 'size'>>
): Promise<BikedeskCustomerArticle> {
  const current = await bdFetch<BikedeskCustomerArticle>(`/customerarticles/${articleId}`);
  return bdFetch<BikedeskCustomerArticle>(`/customerarticles/${articleId}`, {
    method: 'PUT',
    body: JSON.stringify({
      content: {
        id: current.id,
        customerid: current.customerid,
        title: data.title ?? current.title,
        serieno: data.serieno ?? current.serieno,
        color: data.color ?? current.color,
        size: data.size ?? current.size,
      },
    }),
  });
}

export async function getTicketsByArticle(articleId: number): Promise<BikedeskTicket[]> {
  return bdFetch<BikedeskTicket[]>(`/tickets?customerarticleid=${articleId}`);
}

export async function getTicket(ticketId: number): Promise<BikedeskTicketRecord> {
  return bdFetch<BikedeskTicketRecord>(`/tickets/${ticketId}`);
}

export async function getTicketPaymentLink(ticketId: number): Promise<BikedeskPaymentLink> {
  const payload = await bdFetch<unknown>(`/tickets/${ticketId}/paymentlink`);
  return normalizePaymentLinkPayload(payload);
}

export async function getTicketTemplates(): Promise<BikedeskTicketTemplate[]> {
  return bdFetch<BikedeskTicketTemplate[]>('/ticket-templates');
}

export async function getTicketTemplateMaterials(
  templateId: number
): Promise<BikedeskTicketTemplateMaterial[]> {
  return bdFetch<BikedeskTicketTemplateMaterial[]>(`/ticket-templates/${templateId}/materials`);
}

export async function getTicketTemplateGroups(): Promise<BikedeskTicketTemplateGroup[]> {
  return bdFetch<BikedeskTicketTemplateGroup[]>('/ticket-templategroups');
}

export async function getTags(): Promise<BikedeskTag[]> {
  return bdFetch<BikedeskTag[]>('/tickettags');
}

export async function findOrCreateTag(label: string): Promise<BikedeskTag> {
  const tags = await getTags();
  const existing = tags.find((tag) => tag.label.toLowerCase() === label.toLowerCase());
  if (existing) return existing;

  return bdFetch<BikedeskTag>('/tickettags', {
    method: 'POST',
    body: JSON.stringify({ content: { label } }),
  });
}

export async function getUsers(): Promise<BikedeskUser[]> {
  return bdFetch<BikedeskUser[]>('/users');
}

export async function findPlannerUser(): Promise<BikedeskUser | null> {
  const users = await getUsers();
  const activeUsers = users.filter((user) => user.deleted !== 1);
  const exactMatch =
    activeUsers.find((user) => {
      const haystack = normalizeSearchValue(`${user.name ?? ''} ${user.username ?? ''}`.trim());
      return haystack === 'planlaegningen' || haystack === 'planlaegning';
    }) ?? null;

  if (exactMatch) return exactMatch;

  return (
    activeUsers.find((user) => {
      const haystack = normalizeSearchValue(`${user.name ?? ''} ${user.username ?? ''}`);
      return haystack.includes('planlaegning') || haystack.includes('planlaeg');
    }) ?? null
  );
}

export async function getStore(): Promise<BikedeskStore> {
  return bdFetch<BikedeskStore>('/settings/store');
}

export interface CreateTicketPayload {
  customerid: number;
  customerarticleids?: number[];
  description: string;
  type: string;
  status: string;
  startTime: string;
  pickup: string;
  storeid: number;
  assignee?: number;
  tagids?: number[];
}

export async function createTicket(data: CreateTicketPayload): Promise<BikedeskTicket> {
  return bdFetch<BikedeskTicket>('/tickets', {
    method: 'POST',
    body: JSON.stringify({ content: data }),
  });
}

export interface UpdateTicketPayload {
  id: number;
  customerid: number;
  description: string;
  type: string;
  status: string;
  startTime: string;
  pickup: string;
  assignee?: number;
  storeid?: number;
  tagids?: number[];
}

export async function updateTicket(
  ticketId: number,
  data: UpdateTicketPayload
): Promise<BikedeskTicketRecord> {
  return bdFetch<BikedeskTicketRecord>(`/tickets/${ticketId}`, {
    method: 'PUT',
    body: JSON.stringify({ content: data }),
  });
}

export async function attachTemplateToTicket(ticketId: number, templateId: number): Promise<void> {
  await bdFetch<unknown>(`/ticket/${ticketId}/templates`, {
    method: 'POST',
    body: JSON.stringify({ content: { templateid: templateId } }),
  });
}

export async function appendTicketNote(
  ticket: Pick<
    BikedeskTicket,
    'id' | 'customerid' | 'description' | 'type' | 'status' | 'startTime' | 'pickup'
  > &
    Partial<Pick<BikedeskTicket, 'assignee' | 'storeid' | 'tagids'>>,
  note: string
): Promise<void> {
  const description = ticket.description ? `${ticket.description}\n${note}` : note;

  await updateTicket(ticket.id, {
    id: ticket.id,
    customerid: ticket.customerid,
    description,
    type: ticket.type,
    status: ticket.status,
    startTime: ticket.startTime,
    pickup: ticket.pickup,
    assignee: ticket.assignee,
    storeid: ticket.storeid,
    tagids: ticket.tagids,
  });
}

export async function sendSmsThroughBikedesk(data: {
  message: string;
  phone: string;
  customerid?: number;
}): Promise<void> {
  await bdFetch<unknown>('/sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      content: {
        message: data.message,
        items: [{ content: { phone: data.phone, customerid: data.customerid } }],
        sync: false,
      },
    }),
  });
}
