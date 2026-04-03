import type {
  BikedeskCustomer,
  BikedeskCustomerArticle,
  BikedeskStore,
  BikedeskTag,
  BikedeskTicket,
  BikedeskTicketTemplate,
  BikedeskUser,
} from '@/types';
import { getBikedeskAuthHeaders, getBikedeskBaseUrl } from './bikedesk-config';

const BASE_URL = getBikedeskBaseUrl();

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
    headers: { ...getBikedeskAuthHeaders(), ...options.headers },
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
  if (digits.startsWith('45') && digits.length === 10) variants.push(digits.slice(2));
  return [...new Set(variants.filter(Boolean))];
}

export async function findCustomerByPhone(phone: string): Promise<BikedeskCustomer | null> {
  for (const variant of buildPhoneVariants(phone)) {
    const results = await bdFetch<BikedeskCustomer[]>(
      `/customers?phoneno=${encodeURIComponent(variant)}`
    );
    if (results?.length) return results[0];
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
    body: JSON.stringify({ content: { customerid: customerId, ...data } }),
  });
}

export async function getTicketsByArticle(articleId: number): Promise<BikedeskTicket[]> {
  return bdFetch<BikedeskTicket[]>(`/tickets?customerarticleid=${articleId}`);
}

export async function getTicket(ticketId: number): Promise<BikedeskTicket> {
  return bdFetch<BikedeskTicket>(`/tickets/${ticketId}`);
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

export async function attachTemplateToTicket(ticketId: number, templateId: number): Promise<void> {
  await bdFetch<unknown>(`/ticket/${ticketId}/templates`, {
    method: 'POST',
    body: JSON.stringify({ content: { templateid: templateId } }),
  });
}

export async function getTicketTemplates(): Promise<BikedeskTicketTemplate[]> {
  return bdFetch<BikedeskTicketTemplate[]>('/ticket-templates');
}

export async function getTags(): Promise<BikedeskTag[]> {
  return bdFetch<BikedeskTag[]>('/tickettags');
}

export async function findOrCreateTag(label: string): Promise<BikedeskTag> {
  const tags = await getTags();
  const existing = tags.find((t) => t.label.toLowerCase() === label.toLowerCase());
  if (existing) return existing;
  return bdFetch<BikedeskTag>('/tickettags', {
    method: 'POST',
    body: JSON.stringify({ content: { label } }),
  });
}

export async function getUsers(): Promise<BikedeskUser[]> {
  return bdFetch<BikedeskUser[]>('/users');
}

export async function getStore(): Promise<BikedeskStore> {
  return bdFetch<BikedeskStore>('/settings/store');
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
