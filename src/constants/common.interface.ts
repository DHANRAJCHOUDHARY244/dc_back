import { Request } from "express";
import { UploadedFile } from 'express-fileupload';
export interface ResponseData {
  status: number;
  message: string;
  data?: any;
}

export interface Error {
  stack?: string;
}

export interface CustomEmailContent{
  title: string;
  description: string;
}

export interface OtpContentData{
  otp: number;
  title: string;
}

export interface AuthenticatedRequest extends Request {
  [x: string]: {};
  user?: any;
}
export interface DocumentsAuthenticatedRequest extends Request {
  files?: {
    document?: UploadedFile | UploadedFile[]; // 👈 Add this line
    img?: UploadedFile | UploadedFile[]; // 👈 Add this line
    pdf?: UploadedFile | UploadedFile[]; // 👈 Add this line
    [key: string]: UploadedFile | UploadedFile[] | undefined;
  };
  user?: any;
}
export interface UpdateUser {
	name?: string;
	email?: string;
	mobile_no?: string;
	address?: string;
	city?: string;
	role?: string;
	mobile_country_code?: string;
};
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
    custMobNum:string;
    custEmail:string;
    custAddress:string;
    notes:string;
    subTotal:number;
    taxRate:string;
    taxAmount:number;
    discountAmount:number;
    discountRate?:string;
    discountMode?: "rate" | "amount";
    total:number;
    items:QuoteItem[];
    cf_id?:number;
    assessment_id?:number;
    isAttachAssessmentWithQuoteMail?:boolean;
    distance?:number;
    loan_enabled?: boolean;
    loan_meta?: {
      enabled: boolean;
      includesGst: boolean;
      sourceTotal: number;
      annualInterestRate: number;
      selectedTermMonths: number;
      selectedFeePercent: number;
      selected?: {
        termMonths: number;
        feePercent: number;
        merchantFee: number;
        financedAmount: number;
        monthlyEmi: number;
      } | null;
      options: Array<{
        termMonths: number;
        feePercent: number;
        merchantFee: number;
        financedAmount: number;
        monthlyEmi: number;
      }>;
    } | null;
    manual_attachments?: unknown[];
    green_sketch?: unknown | null;
}

export interface AutocompleteCustomerByNameEmailInterface{
  billTo:string;
  billToEmail:string;
}
export interface MenuItem {
  id: string;
  name: string;
  parentId: string | null;
  label: string;
  icon: string | null;
  type: string;
  route: string;
  order: string | null;
  permission_id?: string | null;
  children?: MenuItem[]; // optional for cleaner output
  component: string | null;
  created_at: string;
  updated_at: string;
}


 export interface SendEventEmailParams  {
  email: string;
  subject: string;
  client_name: string;
  id: string | number;
  type: string;
  title: string;
  status: string;
  due_date: string | Date;
  link: string;
  event:string;
};
export interface SendEmailRegSignOtp{
  email: string;
  subject: string;
  client_name: string;
  id: string | number;
  type: string;
  message:string;
  otp?: number;
}