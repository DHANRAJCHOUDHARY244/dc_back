import type { CompanyConfigSnapshot } from "@services/crmSettings.service";
import { getDefaultCompanyConfig } from "@services/crmSettings.service";

export type InstallationScheduledEmailData = {
	customerName: string;
	installationDate: string;
	installationTime: string;
	estimatedDuration: string;
	installationAddress: string;
	installerName: string;
	installerCompany: string;
	installerPhone: string;
	installerEmail: string;
	saaNumber: string;
	electricalLicence: string;
	cecNumber: string;
	productListHtml: string;
	inverter: string;
	panels: string;
	battery: string;
	evCharger: string;
};

export function installationScheduledTemplate(
	data: InstallationScheduledEmailData,
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
  <title>Installation Scheduled</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:24px 12px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" role="presentation" style="max-width:640px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#1d4ed8,#2563eb);padding:28px 32px;color:#fff;">
              <div style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.9;">${companyName}</div>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.35;">Your Solar Installation Has Been Scheduled</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 12px;font-size:16px;">Dear <strong>${data.customerName}</strong>,</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
                Great news!<br/><br/>
                Your Job installation has now been scheduled. Our accredited installation team will arrive on the date and time mentioned below.
              </p>

              <h2 style="margin:24px 0 12px;font-size:16px;color:#1d4ed8;">Installation Details</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                ${row("Installation Date", data.installationDate, true)}
                ${row("Arrival Time", data.installationTime)}
                ${row("Estimated Duration", data.estimatedDuration, true)}
                ${row("Installation Address", data.installationAddress)}
              </table>

              <h2 style="margin:28px 0 12px;font-size:16px;color:#1d4ed8;">Assigned Installer Details</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                ${row("Installer Name", data.installerName, true)}
                ${row("Company Name", data.installerCompany)}
                ${row("Installer Mobile", data.installerPhone, true)}
                ${row("Email", data.installerEmail)}
                ${row("SAA Accreditation No.", data.saaNumber, true)}
                ${row("Electrical Licence No.", data.electricalLicence)}
                ${row("CEC / Solar Accreditation", data.cecNumber, true)}
              </table>

              <h2 style="margin:28px 0 12px;font-size:16px;color:#1d4ed8;">Products to be Installed</h2>
              <div style="font-size:14px;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:12px;background:#f8fafc;">
                ${data.productListHtml || "<em>See quote details</em>"}
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                ${row("Inverter", data.inverter, true)}
                ${row("Solar Panels", data.panels)}
                ${row("Battery (If Applicable)", data.battery, true)}
                ${row("EV Charger (If Applicable)", data.evCharger)}
              </table>

              <h2 style="margin:28px 0 12px;font-size:16px;color:#1d4ed8;">Before Our Team Arrives</h2>
              <ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.7;color:#334155;">
                <li>Please ensure someone over 18 years old is available at the property.</li>
                <li>Kindly provide easy access to the switchboard, roof area, and meter box.</li>
                <li>If you have pets, please keep them secured during the installation.</li>
                <li>Ensure vehicles are moved from the driveway if required.</li>
              </ul>

              <h2 style="margin:28px 0 12px;font-size:16px;color:#1d4ed8;">Need to Reschedule?</h2>
              <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#334155;">
                If you need to change your installation appointment, please contact us at least <strong>24 hours</strong> before your scheduled date.
              </p>
              <p style="margin:0;font-size:14px;line-height:1.7;color:#0f172a;">
                ${phone ? `<strong>Phone:</strong> ${phone}<br/>` : ""}
                ${email ? `<strong>Email:</strong> <a href="mailto:${email}" style="color:#1d4ed8;text-decoration:none;">${email}</a>` : ""}
              </p>

              <p style="margin:28px 0 0;font-size:15px;line-height:1.6;">
                Thank you for choosing <strong>${companyName}</strong>.<br/>
                We look forward to completing your installation safely and professionally.
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
