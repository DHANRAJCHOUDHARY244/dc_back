/** Mongoose populate paths for quote workflow queries */
export const workflowPopulate = [
  { path: "quote" },
  {
    path: "invoice",
    select: "id quote_id pay_status partialAmount paid_date dateOfDue",
  },
  {
    path: "installer",
    select: "id name email mobile_no address",
  },
  {
    path: "sales_person",
    select: "id name email mobile_no address",
  },
  {
    path: "customer",
    select: "id name email mobile_no address",
  },
  { path: "stock_order" },
];

/** @deprecated Use workflowPopulate — kept for gradual controller migration */
export const workflowInclude = workflowPopulate;
