import type { BaseRepository } from "@repositories/BaseRepository";
import {
  activityTrackerRepository,
  advertisingRepository,
  allInOneJobRepository,
  assessmentRepository,
  attendanceRecordRepository,
  calculatorProductRepository,
  chatRepository,
  contactFormRepository,
  customInvoiceRepository,
  documentRepository,
  expenseRepository,
  feedbackCaseRepository,
  holidayRepository,
  installerJobRepository,
  invoiceRepository,
  leadAgentRepository,
  leadRepository,
  leaveRequestRepository,
  messageRepository,
  notificationRepository,
  paymentHistoryRepository,
  popupFormRepository,
  productRepository,
  quoteRepository,
  rebateSchemeRepository,
  roleRepository,
  stockOrderRepository,
  taskRepository,
  trainingCourseRepository,
  userRepository,
  visitorLogsRepository,
} from "@repositories/index";

export type McpCollectionDef = {
  id: string;
  label: string;
  collection: string;
  repo: BaseRepository;
  /** Regex tested against user message */
  keywords: RegExp;
  /** CRM route hint */
  pagePattern?: RegExp;
  /** Safe fields — never includes passwords/tokens */
  select: string;
  /** Field used for status breakdown */
  groupBy?: string;
  sort?: Record<string, 1 | -1>;
  /** One-line row formatter */
  formatRow: (row: Record<string, unknown>) => string;
  /** Optional extra filter from message (e.g. id lookup) */
  buildFilter?: (message: string) => Record<string, unknown>;
};

/** All CRM collections the assistant may read (read-only, safe fields only). */
export const MCP_COLLECTION_REGISTRY: McpCollectionDef[] = [
  {
    id: "leads",
    label: "Leads",
    collection: "leads",
    repo: leadRepository,
    keywords: /\b(leads?|pipeline|enquir(y|ies)|prospect|follow[\s-]?up)\b/i,
    pagePattern: /\/leads?\b/i,
    select: "id name status source owner_id score score_tier phone email state created_at",
    groupBy: "status",
    formatRow: (r) =>
      `#${r.id} ${r.name} | ${r.status} | source: ${r.source || "—"} | tier: ${r.score_tier || "—"}`,
    buildFilter: (m) => {
      const id = m.match(/\b(?:lead\s*#?\s*|id\s*)(\d+)\b/i);
      return id ? { id: Number(id[1]) } : {};
    },
  },
  {
    id: "quotes",
    label: "Quotes",
    collection: "quotes",
    repo: quoteRepository,
    keywords: /\b(quotes?|proposal|kanban|quotient|solar sketch)\b/i,
    pagePattern: /\/quote/i,
    select: "id name total kanban_status customer_accepted created_at",
    groupBy: "kanban_status",
    formatRow: (r) =>
      `#${r.id} ${r.name} | $${Number(r.total || 0).toLocaleString()} | ${r.kanban_status}`,
    buildFilter: (m) => {
      const id = m.match(/\b(?:quote\s*#?\s*|id\s*)(\d+)\b/i);
      return id ? { id: Number(id[1]) } : {};
    },
  },
  {
    id: "invoices",
    label: "Invoices",
    collection: "invoices",
    repo: invoiceRepository,
    keywords: /\b(invoices?|billing|payment status|paid|unpaid|pay_status)\b/i,
    pagePattern: /\/invoice/i,
    select: "id name pay_status quote_id paid_date dateOfDue",
    groupBy: "pay_status",
    formatRow: (r) => `#${r.id} ${r.name} | ${r.pay_status} | quote #${r.quote_id ?? "—"}`,
  },
  {
    id: "custom_invoices",
    label: "Custom invoices",
    collection: "custom_invoices",
    repo: customInvoiceRepository,
    keywords: /\b(custom invoices?|standalone invoice)\b/i,
    select: "id name total pay_status currency customer_id",
    groupBy: "pay_status",
    formatRow: (r) =>
      `#${r.id} ${r.name} | $${Number(r.total || 0).toLocaleString()} | ${r.pay_status}`,
  },
  {
    id: "installer_jobs",
    label: "Installer jobs",
    collection: "installer_jobs",
    repo: installerJobRepository,
    keywords: /\b(installer jobs?|installation job|job board|site visit|install date)\b/i,
    pagePattern: /\/installer-jobs/i,
    select: "id job_number status installer_id installation_date customer_name",
    groupBy: "status",
    sort: { installation_date: -1 },
    formatRow: (r) => {
      const date = r.installation_date
        ? new Date(String(r.installation_date)).toISOString().slice(0, 10)
        : "—";
      return `#${r.id} ${r.job_number || ""} | ${r.status} | ${date}`;
    },
  },
  {
    id: "tasks",
    label: "Tasks",
    collection: "tasks",
    repo: taskRepository,
    keywords: /\b(tasks?|to[\s-]?do|master task|assignment|due date|pending task)\b/i,
    pagePattern: /\/task/i,
    select: "id task_code title name status priority type due_date user_id",
    groupBy: "status",
    formatRow: (r) =>
      `#${r.id} ${r.task_code || r.title || r.name || "—"} | ${r.status} | ${r.priority || "—"}`,
    buildFilter: (m) => {
      const id = m.match(/\b(?:task\s*#?\s*|id\s*)(\d+)\b/i);
      return id ? { id: Number(id[1]) } : {};
    },
  },
  {
    id: "products",
    label: "Products catalog",
    collection: "products",
    repo: productRepository,
    keywords: /\b(products?|catalog|panel|battery|inverter|sku)\b/i,
    pagePattern: /\/product/i,
    select: "id name category brand status",
    groupBy: "category",
    formatRow: (r) => `#${r.id} ${r.name} | ${r.category} | ${r.brand || "—"} | ${r.status}`,
  },
  {
    id: "users",
    label: "Staff users",
    collection: "users",
    repo: userRepository,
    keywords: /\b(users?|staff|employees?|roles?|team member|sales person|installer)\b/i,
    pagePattern: /\/management\/system\/user/i,
    select: "id name role_id is_active is_verified",
    formatRow: (r) => `#${r.id} ${r.name}`,
  },
  {
    id: "contact_forms",
    label: "Contact forms",
    collection: "contact_forms",
    repo: contactFormRepository,
    keywords: /\b(contact form|form submission|website form|enquiry form)\b/i,
    pagePattern: /\/contact-form/i,
    select: "id name email phone created_at",
    formatRow: (r) => `#${r.id} ${r.name || "—"} | ${r.email || "—"}`,
  },
  {
    id: "pre_approval",
    label: "Pre-approval / All-in-one",
    collection: "all_in_one_jobs",
    repo: allInOneJobRepository,
    keywords: /\b(pre[\s-]?approval|all[\s-]?in[\s-]?one|grid assessment|grid connection)\b/i,
    pagePattern: /\/all-in-one|\/pre-approval/i,
    select: "id job_number overall_status customer",
    groupBy: "overall_status",
    formatRow: (r) => {
      const customer = (r.customer as any)?.name || r.job_number || "—";
      return `#${r.id} ${customer} | ${r.overall_status || "—"}`;
    },
  },
  {
    id: "assessments",
    label: "Assessments",
    collection: "assessments",
    repo: assessmentRepository,
    keywords: /\b(assessments?|site assessment|solar assessment)\b/i,
    select: "id name status customer_id created_at",
    groupBy: "status",
    formatRow: (r) => `#${r.id} ${r.name || "—"} | ${r.status || "—"}`,
  },
  {
    id: "payments",
    label: "Payment history",
    collection: "payment_history",
    repo: paymentHistoryRepository,
    keywords: /\b(payments?|payment history|commission payment|installer payment)\b/i,
    select: "id quote_id installer_payment_status sales_person_payment_status installer_total_amount",
    groupBy: "installer_payment_status",
    formatRow: (r) =>
      `#${r.id} quote #${r.quote_id} | installer: ${r.installer_payment_status} | $${Number(r.installer_total_amount || 0).toLocaleString()}`,
  },
  {
    id: "expenses",
    label: "Expenses",
    collection: "expenses",
    repo: expenseRepository,
    keywords: /\b(expenses?|spending|costs?)\b/i,
    select: "id title amount category status date",
    groupBy: "category",
    formatRow: (r) => `#${r.id} ${r.title || "—"} | $${Number(r.amount || 0).toLocaleString()}`,
  },
  {
    id: "stock_orders",
    label: "Stock orders",
    collection: "stock_orders",
    repo: stockOrderRepository,
    keywords: /\b(stock orders?|inventory order|warehouse)\b/i,
    select: "id order_number status supplier created_at",
    groupBy: "status",
    formatRow: (r) => `#${r.id} ${r.order_number || "—"} | ${r.status || "—"}`,
  },
  {
    id: "chats",
    label: "Chats",
    collection: "chats",
    repo: chatRepository,
    keywords: /\b(chats?|conversations?|group chat|direct message)\b/i,
    pagePattern: /\/chat/i,
    select: "id name type members created_at",
    groupBy: "type",
    formatRow: (r) => `#${r.id} ${r.name || "—"} | ${r.type || "—"}`,
  },
  {
    id: "messages",
    label: "Messages",
    collection: "messages",
    repo: messageRepository,
    keywords: /\b(messages?|chat messages?)\b/i,
    select: "id chatId messageType senderId created_at",
    groupBy: "messageType",
    formatRow: (r) => `#${r.id} chat #${r.chatId} | ${r.messageType || "text"}`,
  },
  {
    id: "notifications",
    label: "Notifications",
    collection: "notifications",
    repo: notificationRepository,
    keywords: /\b(notifications?|alerts?|bell)\b/i,
    select: "id message isRead userId created_at",
    groupBy: "isRead",
    formatRow: (r) => `#${r.id} ${String(r.message || "").slice(0, 60)} | read: ${r.isRead}`,
  },
  {
    id: "lead_agents",
    label: "Lead agents",
    collection: "lead_agents",
    repo: leadAgentRepository,
    keywords: /\b(lead agents?|sales agents?|distribution|round robin)\b/i,
    select: "id user_id availability max_leads active",
    groupBy: "availability",
    formatRow: (r) => `#${r.id} user #${r.user_id} | ${r.availability || "—"}`,
  },
  {
    id: "leave",
    label: "Leave requests",
    collection: "leave_requests",
    repo: leaveRequestRepository,
    keywords: /\b(leave|time off|annual leave|sick leave)\b/i,
    pagePattern: /\/leave|\/hr/i,
    select: "id user_id status leave_type_id start_date end_date days",
    groupBy: "status",
    formatRow: (r) =>
      `#${r.id} user #${r.user_id} | ${r.status} | ${r.days} day(s)`,
  },
  {
    id: "attendance",
    label: "Attendance",
    collection: "attendance_records",
    repo: attendanceRecordRepository,
    keywords: /\b(attendance|clock in|clock out|present|absent)\b/i,
    pagePattern: /\/attendance/i,
    select: "id user_id date_key status check_in check_out net_minutes",
    groupBy: "status",
    formatRow: (r) => `#${r.id} user #${r.user_id} | ${r.date_key || "—"} | ${r.status || "—"}`,
  },
  {
    id: "holidays",
    label: "Holidays",
    collection: "holidays",
    repo: holidayRepository,
    keywords: /\b(holidays?|public holiday)\b/i,
    select: "id name date type",
    formatRow: (r) => `${r.name} | ${r.date} | ${r.type || "—"}`,
  },
  {
    id: "training",
    label: "Training courses",
    collection: "training_courses",
    repo: trainingCourseRepository,
    keywords: /\b(training|courses?|learning|onboarding)\b/i,
    pagePattern: /\/training/i,
    select: "id title status category published",
    groupBy: "status",
    formatRow: (r) => `#${r.id} ${r.title || "—"} | ${r.status || "—"}`,
  },
  {
    id: "feedback",
    label: "Feedback cases",
    collection: "feedback_cases",
    repo: feedbackCaseRepository,
    keywords: /\b(feedback|complaints?|support case|ticket)\b/i,
    pagePattern: /\/feedback/i,
    select: "id subject status priority customer_name",
    groupBy: "status",
    formatRow: (r) => `#${r.id} ${r.subject || "—"} | ${r.status} | ${r.priority || "—"}`,
  },
  {
    id: "calculator_products",
    label: "Calculator products",
    collection: "calculator_products",
    repo: calculatorProductRepository,
    keywords: /\b(calculator products?|pricing catalog|calculator catalog)\b/i,
    pagePattern: /\/calculator/i,
    select: "id name category_id brand_id active",
    formatRow: (r) => `#${r.id} ${r.name || "—"} | active: ${r.active}`,
  },
  {
    id: "rebate_schemes",
    label: "Rebate schemes",
    collection: "rebate_schemes",
    repo: rebateSchemeRepository,
    keywords: /\b(rebates?|stc|bstc|solar vic|incentive scheme)\b/i,
    select: "id name state active",
    groupBy: "state",
    formatRow: (r) => `#${r.id} ${r.name || "—"} | ${r.state || "—"}`,
  },
  {
    id: "documents",
    label: "Documents",
    collection: "documents",
    repo: documentRepository,
    keywords: /\b(documents?|letter|contract|agreement)\b/i,
    pagePattern: /\/document/i,
    select: "id title type status created_at",
    groupBy: "type",
    formatRow: (r) => `#${r.id} ${r.title || "—"} | ${r.type || "—"}`,
  },
  {
    id: "advertising",
    label: "Advertising",
    collection: "advertisings",
    repo: advertisingRepository,
    keywords: /\b(advertising|ads?|campaigns?|marketing)\b/i,
    select: "id name platform status budget",
    groupBy: "platform",
    formatRow: (r) => `#${r.id} ${r.name || "—"} | ${r.platform || "—"}`,
  },
  {
    id: "popup_forms",
    label: "Popup forms",
    collection: "popup_forms",
    repo: popupFormRepository,
    keywords: /\b(popup forms?|landing page form)\b/i,
    select: "id name active submissions",
    formatRow: (r) => `#${r.id} ${r.name || "—"} | active: ${r.active}`,
  },
  {
    id: "visitor_logs",
    label: "Quote visitor logs",
    collection: "visitor_logs",
    repo: visitorLogsRepository,
    keywords: /\b(visitor logs?|quote visitors?|online visitors?)\b/i,
    select: "id quote_id online created_at",
    groupBy: "online",
    formatRow: (r) => `#${r.id} quote #${r.quote_id} | online: ${r.online}`,
  },
  {
    id: "activity",
    label: "Activity tracker",
    collection: "activity_trackers",
    repo: activityTrackerRepository,
    keywords: /\b(activity log|audit trail|user activity)\b/i,
    select: "id action module user_id created_at",
    groupBy: "module",
    formatRow: (r) => `#${r.id} ${r.action || "—"} | ${r.module || "—"}`,
  },
];

export const MCP_REGISTRY_BY_ID = new Map(MCP_COLLECTION_REGISTRY.map((d) => [d.id, d]));

/** Compact schema catalog for the AI context block. */
export function buildMcpSchemaCatalog(): string {
  const lines = MCP_COLLECTION_REGISTRY.map((d) => {
    const fields = d.select.split(" ").join(", ");
    const group = d.groupBy ? ` | group by ${d.groupBy}` : "";
    return `  - ${d.label} [${d.collection}]: ${fields}${group}`;
  });
  return ["CRM database schema (read-only, safe fields — passwords/tokens never exposed):", ...lines].join(
    "\n",
  );
}
