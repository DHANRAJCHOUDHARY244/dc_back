import { Roles } from "src/data/dataInserter";

export enum QuoteEmailType {
    CREATED = "CREATED",
    UPDATED = "UPDATED",
    FEEDBACK = "FEEDBACK",
    CLOSED = "CLOSED",
    FOLLOW_UP = "FOLLOW_UP",
    ACCEPTED = "ACCEPTED",
    STATUS_UPDATED="STATUS_UPDATED"
}
export type RoleType = keyof typeof Roles;
export interface QuoteEmailOptions {
    quote_id: string;
    type: QuoteEmailType;
    cc?: string[];
    bcc?: string[];
}
