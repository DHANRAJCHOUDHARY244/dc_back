import type { CompanyConfigSnapshot } from "@services/crmSettings.service";
import { getDefaultCompanyConfig } from "@services/crmSettings.service";

export type ProjectCancelledEmailData = {
	customerName: string;
	quoteNumber: string | number;
	jobNumber: string | number;
	cancellationDate: string;
	cancellationReason: string;
	depositAmount: string;
	refundStatus: string;
	refundDate: string;
};

export function projectCancelledTemplate(
	data: ProjectCancelledEmailData,
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

	const showRefund =
		(data.depositAmount && data.depositAmount !== "—" && data.depositAmount !== "N/A") ||
		(data.refundStatus && data.refundStatus !== "—" && data.refundStatus !== "N/A" && data.refundStatus !== "Not Applicable");

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Project Cancelled</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:24px 12px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" role="presentation" style="max-width:640px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#9f1239,#e11d48);padding:28px 32px;color:#fff;">
              <div style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.9;">${companyName}</div>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.35;">Your Solar Project Has Been Cancelled</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 12px;font-size:16px;">Dear <strong>${data.customerName}</strong>,</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
                We hope you're doing well.<br/><br/>
                We regret to inform you that your solar project has been cancelled.
              </p>

              <h2 style="margin:24px 0 12px;font-size:16px;color:#be123c;">Project Details</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                ${row("Quote Number", String(data.quoteNumber), true)}
                ${row("Job Number", String(data.jobNumber))}
                ${row("Cancellation Date", data.cancellationDate, true)}
              </table>

              <h2 style="margin:28px 0 12px;font-size:16px;color:#be123c;">Cancellation Reason</h2>
              <div style="font-size:14px;border:1px solid #fecdd3;border-radius:12px;padding:14px;background:#fff1f2;color:#9f1239;">
                <strong>${data.cancellationReason}</strong>
              </div>

              ${
								showRefund
									? `
              <h2 style="margin:28px 0 12px;font-size:16px;color:#be123c;">Refund Details</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                ${row("Deposit Paid", data.depositAmount, true)}
                ${row("Refund Status", data.refundStatus)}
                ${row("Expected Refund Date", data.refundDate, true)}
              </table>`
									: ""
							}

              <p style="margin:28px 0 8px;font-size:14px;line-height:1.6;color:#334155;">
                If you have any questions or would like to restart your project in the future, our team will be happy to assist you.
              </p>
              <p style="margin:0;font-size:14px;line-height:1.7;color:#0f172a;">
                ${phone ? `<strong>Phone:</strong> ${phone}<br/>` : ""}
                ${email ? `<strong>Email:</strong> <a href="mailto:${email}" style="color:#be123c;text-decoration:none;">${email}</a>` : ""}
              </p>

              <p style="margin:28px 0 0;font-size:15px;line-height:1.6;">
                Thank you for considering <strong>${companyName}</strong>.
              </p>
              <p style="margin:20px 0 0;font-size:15px;">
                Kind Regards,<br/>
                <strong>${companyName} Team</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:16px 32px;text-align:center;font-size:12px;color:#64748b;">
              &copy; ${new Date().getFullYear()} ${companyName}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
