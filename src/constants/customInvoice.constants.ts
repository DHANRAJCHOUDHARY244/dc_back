import { PaymentStatus } from "./common.enum";
import { QuoteItem } from "./common.interface";

export interface newCustomInvoice {
    customerId?:number;
    invoiceNumber?:string;
    currency:string;
    dateOfDue:string;
    custName:string;
    custEmail:string;
    custAddress:string;
    subTotal:number;
    taxRate:string;
    taxAmount:number;
    discountAmount:number;
    discountRate?:string;
    /** "rate" (%) or "amount" ($). Default rate for legacy invoices. */
    discountMode?: "rate" | "amount";
    total:number;
    items:QuoteItem[];
    pay_status:PaymentStatus;
    partialAmount?:number;
    loan_enabled?:boolean;  
    loan_meta?:any;
    notes?: string;
}