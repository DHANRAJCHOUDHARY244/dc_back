import { quoteRepository } from "@repositories";
import { isQuoteAdmin } from "@services/adminPermission.service";
import { Roles } from "src/data/dataInserter";

export type InvoiceActor = {
  id: number;
  role?: string;
};

export function isInvoiceElevated(user: InvoiceActor): boolean {
  return user.role === Roles.SUPER_ADMIN || user.role === Roles.CUSTOMER_SUPPORT_EXECUTIVE;
}

export async function buildQuoteInvoiceListFilter(user: InvoiceActor): Promise<Record<string, unknown>> {
  if (isInvoiceElevated(user)) return {};
  if (await isQuoteAdmin(user)) return {};

  if (user.role === Roles.CUSTOMER) {
    const quotes = await quoteRepository.find({ customer_id: user.id }, { select: "id", lean: true });
    return { quote_id: { $in: quotes.map((q: any) => q.id) } };
  }

  return { sender_id: user.id };
}

export async function canAccessQuoteInvoice(
  user: InvoiceActor,
  invoice: { sender_id?: number | null; quote_id?: number | null },
  quote?: { customer_id?: number | null; sender_id?: number | null } | null,
): Promise<boolean> {
  if (isInvoiceElevated(user)) return true;
  if (await isQuoteAdmin(user)) return true;
  if (Number(invoice.sender_id) === Number(user.id)) return true;
  if (quote && Number(quote.customer_id) === Number(user.id)) return true;
  if (quote && Number(quote.sender_id) === Number(user.id)) return true;
  return false;
}

export function canAccessCustomInvoice(
  user: InvoiceActor,
  invoice: { sender_id?: number | null; customer_id?: number | null },
): boolean {
  if (isInvoiceElevated(user)) return true;
  if (Number(invoice.sender_id) === Number(user.id)) return true;
  if (Number(invoice.customer_id) === Number(user.id)) return true;
  return false;
}

export function canMutateCustomInvoice(user: InvoiceActor, invoice: { sender_id?: number | null }): boolean {
  if (isInvoiceElevated(user)) return true;
  return Number(invoice.sender_id) === Number(user.id);
}
