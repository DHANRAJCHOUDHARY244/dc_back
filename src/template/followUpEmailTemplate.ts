import type { CompanyConfigSnapshot } from "@services/crmSettings.service";
import { getDefaultCompanyConfig } from "@services/crmSettings.service";

interface FollowUpEmailParams {
  orderId: number;
  note: string;
  priority: "normal" | "urgent";
  createdBy: string;
  followUpDate?: string | null;
  status: string;
  link: string;
  companyName?: string;
  recipientRole?: string;
  cfg?: CompanyConfigSnapshot;
}

export const followUpEmailTemplate = ({
  orderId,
  note,
  priority,
  createdBy,
  followUpDate,
  status,
  link,
  companyName,
  recipientRole,
  cfg = getDefaultCompanyConfig(),
}: FollowUpEmailParams): string => {
  const brandName = companyName || cfg.nameShort;
  const isUrgent = priority === "urgent";
  const accentColor = isUrgent ? "#FF3B30" : "#5856D6";
  const accentBg = isUrgent ? "#FFF0EF" : "#F0EFFE";
  const priorityBadge = isUrgent
    ? `<span style="display:inline-block;padding:3px 10px;border-radius:6px;background:#FFEBEE;color:#FF3B30;font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">⚠ URGENT</span>`
    : "";

  const followUpDateRow = followUpDate
    ? `<tr>
        <td style="padding:10px 0;color:#86868B;font-size:12px;font-weight:600;width:120px;vertical-align:top;">Follow-up Date</td>
        <td style="padding:10px 0;color:#1D1D1F;font-size:13px;font-weight:600;">${followUpDate}</td>
      </tr>`
    : "";

  const roleLabel = recipientRole === "driver" ? "Driver" : recipientRole === "company" ? "Company" : "Team";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stock Order Follow-Up</title>
</head>
<body style="margin:0;padding:0;background:#F5F5F7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F7;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,${accentColor},${accentColor}BB);border-radius:20px 20px 0 0;padding:32px 40px;text-align:center;">
              <div style="font-size:28px;margin-bottom:8px;">📦</div>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">
                Stock Order #${String(orderId).padStart(4, "0")}
              </h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;font-weight:500;">
                New Follow-Up ${isUrgent ? "— Urgent Attention Required" : "Note"}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:36px 40px;">

              <!-- Greeting -->
              <p style="margin:0 0 20px;color:#424245;font-size:14px;line-height:1.6;">
                Hi ${roleLabel},
              </p>
              <p style="margin:0 0 24px;color:#6E6E73;font-size:13px;line-height:1.6;">
                A new follow-up note has been added to Stock Order <strong style="color:#1D1D1F;">#${String(orderId).padStart(4, "0")}</strong>${companyName ? ` for <strong style="color:#1D1D1F;">${companyName}</strong>` : ""}.
              </p>

              <!-- Note Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background:${accentBg};border-left:4px solid ${accentColor};border-radius:0 12px 12px 0;padding:20px 24px;">
                    ${priorityBadge ? `<div style="margin-bottom:10px;">${priorityBadge}</div>` : ""}
                    <p style="margin:0;color:#1D1D1F;font-size:14px;line-height:1.7;font-weight:500;">
                      ${note.replace(/\n/g, "<br/>")}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Details Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;border-collapse:collapse;">
                <tr>
                  <td style="padding:10px 0;color:#86868B;font-size:12px;font-weight:600;width:120px;vertical-align:top;border-bottom:1px solid #E8E8ED;">Status</td>
                  <td style="padding:10px 0;color:#1D1D1F;font-size:13px;font-weight:600;border-bottom:1px solid #E8E8ED;">
                    <span style="display:inline-block;padding:3px 10px;border-radius:6px;background:${accentBg};color:${accentColor};font-size:11px;font-weight:700;">${status}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;color:#86868B;font-size:12px;font-weight:600;width:120px;vertical-align:top;border-bottom:1px solid #E8E8ED;">Added By</td>
                  <td style="padding:10px 0;color:#1D1D1F;font-size:13px;font-weight:600;border-bottom:1px solid #E8E8ED;">${createdBy}</td>
                </tr>
                ${followUpDateRow}
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${link}" target="_blank"
                      style="display:inline-block;padding:14px 40px;background:${accentColor};color:#ffffff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:700;letter-spacing:-0.2px;">
                      View Stock Order →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F5F5F7;border-radius:0 0 20px 20px;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 8px;color:#86868B;font-size:11px;font-weight:600;">
                ${brandName} — Stock Order Management System
              </p>
              <p style="margin:0;color:#AEAEB2;font-size:10px;">
                This is an automated notification. Please do not reply directly.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};
