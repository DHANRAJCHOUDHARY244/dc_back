export interface ICreatePaymentBody {
  quote_id: number;
  installer_id?: number;
  sales_person_id?: number;
  installer_total_amount?: number;
  installer_partial_paid_amount?: number;
  installer_tax?: number;
  installer_payment_status?: string;
  installer_payment_date?: Date;
  installer_transaction_id?: string;
  sales_person_total_amount?: number;
  sales_person_partial_paid_amount?: number;
  sales_person_tax?: number;
  sales_person_payment_status?: string;
  sales_person_payment_date?: Date;
  sales_person_transaction_id?: string;
}

export interface IUpdateInstallerBody {
  installer_total_amount?: number;
  installer_partial_paid_amount?: number;
  installer_tax?: number;
  installer_payment_status?: string;
  installer_payment_date?: Date;
  installer_transaction_id?: string;
}

export interface IUpdateSalesPersonBody {
  sales_person_total_amount?: number;
  sales_person_partial_paid_amount?: number;
  sales_person_tax?: number;
  sales_person_payment_status?: string;
  sales_person_payment_date?: Date;
  sales_person_transaction_id?: string;
}