import { FORBIDDEN_CODE } from "@constants/serverCode";
import { quoteRepository } from "@repositories";
import { isQuoteAdmin } from "@services/adminPermission.service";
import { Roles } from "src/data/dataInserter";

export type QuoteActor = {
  id: number;
  role?: string;
};

export type QuoteAccessRow = {
  sender_id?: number | null;
  customer_id?: number | null;
};

export async function canAccessQuote(user: QuoteActor | null | undefined, quote: QuoteAccessRow): Promise<boolean> {
  if (!user?.id) return false;
  if (user.role === Roles.SUPER_ADMIN) return true;
  if (await isQuoteAdmin(user)) return true;
  return (
    Number(quote.sender_id) === Number(user.id) || Number(quote.customer_id) === Number(user.id)
  );
}

export async function loadQuoteForUser<T extends QuoteAccessRow>(
  quoteId: number,
  user: QuoteActor,
  options: Record<string, unknown> = {},
): Promise<T | null> {
  const quote = (await quoteRepository.findOne({ id: quoteId }, options)) as T | null;
  if (!quote) return null;
  if (!(await canAccessQuote(user, quote))) return null;
  return quote;
}

export async function assertQuoteAccess(user: QuoteActor, quote: QuoteAccessRow): Promise<void> {
  if (!(await canAccessQuote(user, quote))) {
    const err: any = new Error("You do not have permission to access this quote");
    err.statusCode = FORBIDDEN_CODE;
    throw err;
  }
}
