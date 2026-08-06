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
  LOST: "Lost",
  CANCELLED: "Cancelled",
  DUPLICATE: "Duplicate",
};

export const LEAD_SOURCES = [
  "Facebook Ads",
  "Instagram Ads",
  "Google Ads",
  "Website",
  "Landing Page",
  "WhatsApp",
  "Messenger",
  "Phone Call",
  "Referral",
  "CSV Import",
  "Manual",
  "Other",
] as const;

export const LEAD_SCORE_TIERS = ["HOT", "WARM", "COLD"] as const;
export type LeadScoreTier = (typeof LEAD_SCORE_TIERS)[number];

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

  score = Math.max(0, Math.min(100, Math.round(score)));
  const tier: LeadScoreTier = score >= 70 ? "HOT" : score >= 40 ? "WARM" : "COLD";
  return { score, tier };
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
