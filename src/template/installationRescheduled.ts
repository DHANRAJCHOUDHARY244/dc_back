import type { CompanyConfigSnapshot } from "@services/crmSettings.service";
import { getDefaultCompanyConfig } from "@services/crmSettings.service";

export type InstallationRescheduledEmailData = {
	customerName: string;
	reason: string;
	previousInstallationDate: string;
	newInstallationDate: string;
	newInstallationTime: string;
	estimatedDuration: string;
	installationAddress: string;
	installerName: string;
	installerCompany: string;
	installerPhone: string;
	saaNumber: string;
	electricalLicence: string;
};

export function installationRescheduledTemplate(
	data: InstallationRescheduledEmailData,
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

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Installation Rescheduled</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:24px 12px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" role="presentation" style="max-width:640px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#b45309,#d97706);padding:28px 32px;color:#fff;">
              <div style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.9;">${companyName}</div>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.35;">Your Installation Schedule Has Been Updated</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 12px;font-size:16px;">Dear <strong>${data.customerName}</strong>,</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
                We hope you're doing well.<br/><br/>
                We would like to inform you that your installation appointment has been <strong>rescheduled</strong> due to <strong>${data.reason}</strong>.
                We sincerely apologize for any inconvenience and appreciate your understanding.
              </p>

              <h2 style="margin:24px 0 12px;font-size:16px;color:#b45309;">Updated Installation Details</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                ${row("Previous Date", data.previousInstallationDate, true)}
                ${row("New Installation Date", data.newInstallationDate)}
                ${row("Arrival Time", data.newInstallationTime, true)}
                ${row("Estimated Duration", data.estimatedDuration)}
                ${row("Installation Address", data.installationAddress, true)}
              </table>

              <h2 style="margin:28px 0 12px;font-size:16px;color:#b45309;">Assigned Installer</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                ${row("Installer Name", data.installerName, true)}
                ${row("Company", data.installerCompany)}
                ${row("Installer Contact", data.installerPhone, true)}
                ${row("SAA Accreditation No.", data.saaNumber)}
                ${row("Electrical Licence No.", data.electricalLicence, true)}
              </table>

              <h2 style="margin:28px 0 12px;font-size:16px;color:#b45309;">Reason for Rescheduling</h2>
              <div style="font-size:14px;border:1px solid #fde68a;border-radius:12px;padding:14px;background:#fffbeb;color:#92400e;">
                <strong>${data.reason}</strong>
              </div>

              <h2 style="margin:28px 0 12px;font-size:16px;color:#b45309;">Need Assistance?</h2>
              <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#334155;">
                If the new appointment is not suitable, please contact us and we'll be happy to arrange another convenient date.
              </p>
              <p style="margin:0;font-size:14px;line-height:1.7;color:#0f172a;">
                ${phone ? `<strong>Phone:</strong> ${phone}<br/>` : ""}
                ${email ? `<strong>Email:</strong> <a href="mailto:${email}" style="color:#b45309;text-decoration:none;">${email}</a>` : ""}
              </p>

              <p style="margin:28px 0 0;font-size:15px;line-height:1.6;">
                Thank you for your patience and understanding.<br/>
                We appreciate your continued trust in <strong>${companyName}</strong> and look forward to completing your installation.
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
