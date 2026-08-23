/** Lead pipeline statuses for AI Lead Management */
export const LEAD_STATUSES = [
  "NEW_LEAD",
  "AI_QUALIFIED",
  "ASSIGNED",
  "CALL_ATTEMPT_1",
  "CALL_ATTEMPT_2",
  "CALL_ATTEMPT_3",
  "CONNECTED",
  "NOT_REACHABLE",
  "VOICEMAIL",
  "WRONG_NUMBER",
  "INTERESTED",
  "VERY_INTERESTED",
  "NEED_FOLLOW_UP",
  "QUOTE_REQUESTED",
  "QUOTE_SENT",
  "QUOTE_VIEWED",
  "NEGOTIATION",
  "ACCEPTED",
  "DEPOSIT_PENDING",
  "DEPOSIT_PAID",
  "STOCK_ORDERED",
  "DELIVERY_SCHEDULED",
  "INSTALLATION_SCHEDULED",
  "INSTALLED",
  "GRID_PENDING",
  "GRID_APPROVED",
  "COMPLETED",
  "REVIEW_REQUESTED",
  "REVIEW_RECEIVED",
  "REFERRAL_RECEIVED",
  "SITE_INSPECTION",
  "FINANCE_PENDING",
  "UNQUALIFIED",
  "WON",
  "LOST",
  "CANCELLED",
  "DUPLICATE",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW_LEAD: "New Lead",
  AI_QUALIFIED: "AI Qualified",
  ASSIGNED: "Assigned",
  CALL_ATTEMPT_1: "Call Attempt 1",
  CALL_ATTEMPT_2: "Call Attempt 2",
  CALL_ATTEMPT_3: "Call Attempt 3",
  CONNECTED: "Connected",
  NOT_REACHABLE: "Not Reachable",
  VOICEMAIL: "Voicemail",
  WRONG_NUMBER: "Wrong Number",
  INTERESTED: "Interested",
  VERY_INTERESTED: "Very Interested",
  NEED_FOLLOW_UP: "Need Follow-up",
  QUOTE_REQUESTED: "Quote Requested",
  QUOTE_SENT: "Quote Sent",
  QUOTE_VIEWED: "Quote Viewed",
  NEGOTIATION: "Negotiation",
  ACCEPTED: "Accepted",
  DEPOSIT_PENDING: "Deposit Pending",
  DEPOSIT_PAID: "Deposit Paid",
  STOCK_ORDERED: "Stock Ordered",
  DELIVERY_SCHEDULED: "Delivery Scheduled",
  INSTALLATION_SCHEDULED: "Installation Scheduled",
  INSTALLED: "Installed",
  GRID_PENDING: "Grid Pending",
  GRID_APPROVED: "Grid Approved",
  COMPLETED: "Completed",
  REVIEW_REQUESTED: "Review Requested",
  REVIEW_RECEIVED: "Review Received",
  REFERRAL_RECEIVED: "Referral Received",
  SITE_INSPECTION: "Site Inspection",
  FINANCE_PENDING: "Finance Pending",
  UNQUALIFIED: "Unqualified",
  WON: "Won",
  LOST: "Lost",
  CANCELLED: "Cancelled",
  DUPLICATE: "Duplicate",
};

export const LEAD_SOURCES = [
  "Facebook Ads",
  "Instagram Ads",
  "Google Ads",
  "Google Lead Forms",
  "Website",
  "Landing Page",
  "WhatsApp",
  "Messenger",
  "Inbound Call",
  "Cold Call",
  "Phone Call",
  "Sales Representative",
  "Referral",
  "Existing Customer",
  "CSV Import",
  "Manual",
  "Other Campaign",
  "Other",
] as const;

export const CONVERTED_LEAD_STATUSES = ["WON", "COMPLETED", "ACCEPTED", "DEPOSIT_PAID"] as const;
export const DEAD_LEAD_STATUSES = ["LOST", "UNQUALIFIED", "DUPLICATE"] as const;
export const CANCELLED_LEAD_STATUSES = ["CANCELLED"] as const;
export const PENDING_LEAD_STATUSES = [
  "NEW_LEAD",
  "AI_QUALIFIED",
  "ASSIGNED",
  "NEED_FOLLOW_UP",
  "CALL_ATTEMPT_1",
  "CALL_ATTEMPT_2",
  "CALL_ATTEMPT_3",
  "NOT_REACHABLE",
  "VOICEMAIL",
] as const;
export const TERMINAL_LEAD_STATUSES = [
  ...CONVERTED_LEAD_STATUSES,
  ...DEAD_LEAD_STATUSES,
  ...CANCELLED_LEAD_STATUSES,
] as const;

export function classifyLeadBucket(status?: string | null) {
  const s = String(status || "");
  if ((CONVERTED_LEAD_STATUSES as readonly string[]).includes(s)) return "converted" as const;
  if ((DEAD_LEAD_STATUSES as readonly string[]).includes(s)) return "dead" as const;
  if ((CANCELLED_LEAD_STATUSES as readonly string[]).includes(s)) return "cancelled" as const;
  if ((PENDING_LEAD_STATUSES as readonly string[]).includes(s)) return "pending" as const;
  return "active" as const;
}

export const LEAD_SCORE_TIERS = ["VERY_HOT", "HOT", "WARM", "COLD", "LOW"] as const;
export type LeadScoreTier = (typeof LEAD_SCORE_TIERS)[number];

export const LEAD_TRANSFER_REASONS = [
  "Customer Requested Different Salesperson",
  "Wrong Territory",
  "Wrong Product",
  "Salesperson Unavailable",
  "Customer Requested Specialist",
  "Workload",
  "Language Requirement",
  "Other",
] as const;

export const LEAD_NOTE_TYPES = [
  "Customer Notes",
  "Call Notes",
  "Follow-Up Notes",
  "Technical Notes",
  "Pricing Notes",
  "Objection",
  "Customer Requirement",
  "Competitor Information",
  "Transfer Notes",
] as const;

export const AGENT_AVAILABILITY = [
  "Available",
  "Busy",
  "Temporarily Unavailable",
  "On Leave",
  "Offline",
  "Do Not Assign Leads",
  "Limited Capacity",
] as const;

export const DISTRIBUTION_MODES = [
  "ai_smart",
  "round_robin",
  "area",
  "team",
  "product",
  "capacity",
  "manual",
] as const;

export const KANBAN_COLUMNS = [
  { key: "NEW", label: "New Lead", statuses: ["NEW_LEAD", "AI_QUALIFIED"] },
  { key: "CONTACTED", label: "Contacted", statuses: ["ASSIGNED", "CALL_ATTEMPT_1", "CALL_ATTEMPT_2", "CALL_ATTEMPT_3", "CONNECTED", "NOT_REACHABLE", "VOICEMAIL", "WRONG_NUMBER"] },
  { key: "QUALIFIED", label: "Qualified", statuses: ["INTERESTED", "VERY_INTERESTED"] },
  { key: "APPOINTMENT", label: "Appointment", statuses: ["NEED_FOLLOW_UP"] },
  { key: "SITE", label: "Site Assessment", statuses: ["SITE_INSPECTION"] },
  { key: "QUOTE", label: "Quote Sent", statuses: ["QUOTE_REQUESTED", "QUOTE_SENT", "QUOTE_VIEWED"] },
  { key: "FOLLOW_UP", label: "Follow-Up", statuses: ["NEED_FOLLOW_UP"] },
  { key: "NEGOTIATION", label: "Negotiation", statuses: ["NEGOTIATION"] },
  { key: "FINANCE", label: "Finance", statuses: ["DEPOSIT_PENDING", "FINANCE_PENDING", "DEPOSIT_PAID"] },
  { key: "WON", label: "Won", statuses: ["ACCEPTED", "WON", "STOCK_ORDERED", "DELIVERY_SCHEDULED", "INSTALLATION_SCHEDULED", "INSTALLED", "GRID_PENDING", "GRID_APPROVED", "COMPLETED"] },
  { key: "LOST", label: "Lost", statuses: ["LOST", "CANCELLED", "UNQUALIFIED", "DUPLICATE"] },
] as const;

export const CUSTOMER_TYPES = ["Residential", "Commercial", "Industrial", "Government"] as const;
export const PURCHASE_TIMEFRAMES = ["This week", "This month", "1-3 months", "3-6 months", "Just researching"] as const;

export const PROPERTY_TYPES = ["House", "Townhouse", "Apartment", "Commercial", "Farm"] as const;
export const OWNERSHIP_TYPES = ["Owner", "Tenant"] as const;
export const BILL_RANGES = ["$0-$100", "$100-$200", "$200-$300", "$300+"] as const;
export const CURRENT_SYSTEMS = ["No Solar", "Existing Solar", "Solar + Battery"] as const;
export const INTERESTED_PRODUCTS = [
  "Solar Panels",
  "Battery",
  "Heat Pump",
  "Air Conditioner",
  "EV Charger",
  "Maintenance",
  "Other",
] as const;
export const ROOF_TYPES = ["Tile", "Metal", "Flat", "Other"] as const;
export const BEST_TIMES = ["Morning", "Afternoon", "Evening", "Anytime"] as const;
export const PREFERRED_CONTACTS = ["Phone", "WhatsApp", "SMS", "Email"] as const;

export function computeLeadScore(input: {
  bill_range?: string | null;
  interested_in?: string[] | null;
  ownership?: string | null;
  property_type?: string | null;
  response_speed_seconds?: number | null;
  state?: string | null;
  purchase_timeframe?: string | null;
  engagement_count?: number | null;
  has_quote?: boolean | null;
  appointment_confirmed?: boolean | null;
  estimated_sales_value?: number | null;
  last_contacted_at?: Date | string | null;
}): { score: number; tier: LeadScoreTier } {
  let score = 20;

  switch (input.bill_range) {
    case "$300+":
      score += 35;
      break;
    case "$200-$300":
      score += 28;
      break;
    case "$100-$200":
      score += 18;
      break;
    case "$0-$100":
      score += 8;
      break;
    default:
      break;
  }

  const interests = Array.isArray(input.interested_in) ? input.interested_in : [];
  if (interests.includes("Solar Panels")) score += 12;
  if (interests.includes("Battery")) score += 10;
  if (interests.includes("EV Charger") || interests.includes("Heat Pump")) score += 6;

  if (input.ownership === "Owner") score += 15;
  if (input.property_type === "House" || input.property_type === "Farm") score += 8;
  if (input.property_type === "Commercial") score += 10;

  if (input.response_speed_seconds != null && input.response_speed_seconds <= 30) score += 10;
  else if (input.response_speed_seconds != null && input.response_speed_seconds <= 120) score += 5;

  if (["VIC", "NSW", "ACT", "QLD", "SA", "WA"].includes(String(input.state || "").toUpperCase())) {
    score += 5;
  }

  switch (input.purchase_timeframe) {
    case "This week":
      score += 20;
      break;
    case "This month":
      score += 12;
      break;
    case "1-3 months":
      score += 6;
      break;
    default:
      break;
  }

  if (input.engagement_count) score += Math.min(15, Number(input.engagement_count) * 3);
  if (input.has_quote) score += 8;
  if (input.appointment_confirmed) score += 10;
  if (Number(input.estimated_sales_value) >= 10000) score += 8;
  if (input.last_contacted_at) score += 4;

  score = Math.max(0, Math.min(100, Math.round(score)));
  let tier: LeadScoreTier = "LOW";
  if (score >= 90) tier = "VERY_HOT";
  else if (score >= 75) tier = "HOT";
  else if (score >= 50) tier = "WARM";
  else if (score >= 25) tier = "COLD";
  return { score, tier };
}

export function publicLeadId(id: number) {
  return `SE${String(id).padStart(5, "0")}`;
}

export function buyingIntentFromScore(score: number) {
  if (score >= 90) return "Very High";
  if (score >= 75) return "High";
  if (score >= 50) return "Medium";
  if (score >= 25) return "Low";
  return "Very Low";
}

export function conversionProbabilityFromScore(score: number) {
  return Math.max(2, Math.min(95, Math.round(score * 0.85)));
}

export function buildAiLeadSummary(lead: {
  name?: string;
  interested_in?: string[];
  current_system?: string;
  solar_system_size?: string;
  battery_size?: string;
  bill_range?: string;
  purchase_timeframe?: string;
  best_time_to_call?: string;
  suburb?: string;
  state?: string;
  note?: string;
}) {
  const interests = Array.isArray(lead.interested_in) && lead.interested_in.length ? lead.interested_in.join(" and ") : "solar";
  const size = lead.solar_system_size ? ` around ${lead.solar_system_size}` : "";
  const battery = lead.battery_size ? ` Battery interest: ${lead.battery_size}.` : "";
  const existing = lead.current_system && lead.current_system !== "No Solar" ? ` Existing system: ${lead.current_system}${size}.` : "";
  const bill = lead.bill_range ? ` Electricity bill is ${lead.bill_range}.` : "";
  const when = lead.purchase_timeframe ? ` Timeframe: ${lead.purchase_timeframe}.` : "";
  const contact = lead.best_time_to_call ? ` Best contact: ${lead.best_time_to_call}.` : "";
  const loc = [lead.suburb, lead.state].filter(Boolean).join(", ");
  const locBit = loc ? ` Location: ${loc}.` : "";
  const extra = lead.note ? ` Note: ${String(lead.note).slice(0, 140)}` : "";
  return `${lead.name || "Customer"} is interested in ${interests}.${existing}${battery}${bill}${when}${contact}${locBit}${extra}`.trim();
}

export function buildFollowUpScripts(lead: {
  name?: string;
  interested_in?: string[];
  bill_range?: string;
  next_best_action?: string;
}) {
  const name = lead.name?.split(" ")[0] || "there";
  const interest = Array.isArray(lead.interested_in) && lead.interested_in.length ? lead.interested_in[0] : "solar";
  return {
    whatsapp: `Hi ${name}, this is Soms Energy following up on your ${interest} enquiry. Would you like a tailored quote this week?`,
    sms: `Hi ${name}, Soms Energy here — we can send your ${interest} pricing today. Reply YES to book a call.`,
    email: `Hi ${name},\n\nThanks for your enquiry. Based on your interest in ${interest}${lead.bill_range ? ` and a typical bill of ${lead.bill_range}` : ""}, we can prepare options and next steps.\n\nKind regards,\nSoms Energy`,
    call_script: `Call ${name}. Open with their ${interest} enquiry. Confirm bill, property type, and preferred install window. Offer a site assessment or quote. Next action: ${lead.next_best_action || "qualify and book follow-up"}.`,
  };
}

export function buildWelcomeMessage(customerName?: string | null, companyName = "Soms Energy") {
  const name = customerName?.trim() || "there";
  return `Hi ${name} 👋

Thank you for contacting ${companyName}.

I'm ${companyName}'s AI Assistant.

I'll quickly collect a few details so our solar consultant can prepare the best solution for you.`;
}

export function buildQualificationThanksMessage(companyName = "Soms Energy") {
  return `Thank you 😊

One of our solar consultants will contact you shortly.

— ${companyName}`;
}
