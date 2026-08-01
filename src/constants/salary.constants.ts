export interface CreateSalaryBody {
  user_id: number;
  date: string;
  basic: number;
  bonus?: number;
  tds?: number;
  pf?: number;
  bank_details: Record<string, unknown>;
  email: string;
  employee_name: string;
  cc?: string[] | string;
  bcc?: string[] | string;
}