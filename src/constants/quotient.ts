export interface QuoteItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  price: number;
}
export interface newQuote {
    customerId?:number;
    invoiceNumber?:string;
    currency:string;
    dateOfDue:string;
    custName:string;
    custEmail:string;
    custAddress:string;
    notes:string;
    subTotal:number;
    taxRate:string;
    taxAmount:number;
    discountAmount:number;
    discountRate?:string;
    total:number;
    items:QuoteItem[];
}
