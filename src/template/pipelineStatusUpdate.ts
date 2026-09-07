import type { CompanyConfigSnapshot } from "@services/crmSettings.service";
import { getDefaultCompanyConfig } from "@services/crmSettings.service";

export type PipelineStatusUpdateEmailData = {
	customerName: string;
	quoteNumber: string | number;
	fromStatus: string;
	toStatus: string;
	statusDate: string;
	notes?: string;
};

export function pipelineStatusUpdateTemplate(
	data: PipelineStatusUpdateEmailData,
	cfg: CompanyConfigSnapshot = getDefaultCompanyConfig(),
) {
	const companyName = cfg.name || "Our Team";
	const phone = cfg.phoneNumber || cfg.phone || "";
	const email = cfg.emailSupport || cfg.email || "";

	const row = (label: string, value: string, alt = false) => `
    <tr style="background:${alt ? "#f8fafc" : "#ffffff"};">
      <td style="padding:10px 14px;width:40%;"><strong>${label}</strong></td>
      <td style="padding:10px 14px;">${value || "—"}</td>
    </tr>`;

	const notesBlock = data.notes
		? `<p style="margin:16px 0 0;padding:12px 14px;background:#f8fafc;border-radius:10px;font-size:14px;line-height:1.5;color:#334155;">
        <strong style="display:block;margin-bottom:4px;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;">Update notes</strong>
        ${data.notes}
      </p>`
		: "";

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Project Status Update</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:24px 12px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" role="presentation" style="max-width:640px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a,#1d4ed8);padding:28px 32px;color:#fff;">
              <div style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.9;">${companyName}</div>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.35;">Your Project Status Has Been Updated</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hi ${data.customerName},</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">
                We’ve updated the status on your solar project (Quote #${data.quoteNumber}).
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                ${row("Previous status", data.fromStatus)}
                ${row("New status", data.toStatus, true)}
                ${row("Status date", data.statusDate)}
              </table>
              ${notesBlock}
              <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#64748b;">
                If you have any questions, reply to this email or contact us${phone ? ` on ${phone}` : ""}${email ? ` / ${email}` : ""}.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;">
              ${companyName}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
