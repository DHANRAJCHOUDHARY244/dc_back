export interface CreateQuoteWorkflowDTO {
  quote_id?: number;
  invoice_id?: number;
  stock_id?: number;

  installer_id?: number;
  customer_id?: number;
  sales_person_id?: number;

  installer_payment_status?: string;
  installer_payment?: number;

  sales_person_payment_status?: string;
  sales_person_payment?: number;

  rebate_received?: number;
}

export interface UpdateQuoteWorkflowDTO
  extends Partial<CreateQuoteWorkflowDTO> {}

export interface UploadInstallerDocsDTO {
  workflowId: number;
}