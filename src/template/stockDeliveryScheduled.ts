import type { CompanyConfigSnapshot } from "@services/crmSettings.service";
import { getDefaultCompanyConfig } from "@services/crmSettings.service";

export type StockDeliveryEmailData = {
	customerName: string;
	orderNumber: string | number;
	productListHtml: string;
	orderDate: string;
	deliveryDate: string;
	deliveryTime: string;
	deliveryAddress: string;
	driverName: string;
	driverPhone: string;
	vehicleNumber: string;
	trackingNumber: string;
};

/**
 * Customer-facing email when stock is confirmed / delivery scheduled.
 */
export function stockDeliveryScheduledTemplate(
	data: StockDeliveryEmailData,
	cfg: CompanyConfigSnapshot = getDefaultCompanyConfig(),
) {
	const companyName = cfg.name || "Our Team";
	const phone = cfg.phoneNumber || cfg.phone || "";
	const email = cfg.emailSupport || cfg.email || "";
	const website = cfg.website || "";
	const websiteDisplay = cfg.websiteDisplay || website.replace(/^https?:\/\//, "");

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Order Confirmed & Delivery Scheduled</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:24px 12px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" role="presentation" style="max-width:640px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#0f766e,#059669);padding:28px 32px;color:#fff;">
              <div style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.9;">${companyName}</div>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.35;">Your Order Has Been Confirmed &amp; Delivery Scheduled</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 12px;font-size:16px;">Dear <strong>${data.customerName}</strong>,</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
                Thank you for choosing <strong>${companyName}</strong>.
                We're pleased to inform you that your order has been successfully confirmed, and your equipment has now been dispatched from our warehouse.
              </p>

              <h2 style="margin:24px 0 12px;font-size:16px;color:#0f766e;">Order Details</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                <tr style="background:#f8fafc;">
                  <td style="padding:10px 14px;width:40%;"><strong>Order Number</strong></td>
                  <td style="padding:10px 14px;">#${data.orderNumber}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;vertical-align:top;"><strong>Products Ordered</strong></td>
                  <td style="padding:10px 14px;">${data.productListHtml}</td>
                </tr>
                <tr style="background:#f8fafc;">
                  <td style="padding:10px 14px;"><strong>Order Date</strong></td>
                  <td style="padding:10px 14px;">${data.orderDate}</td>
                </tr>
              </table>

              <h2 style="margin:28px 0 12px;font-size:16px;color:#0f766e;">Delivery Information</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                <tr style="background:#f8fafc;">
                  <td style="padding:10px 14px;width:40%;"><strong>Expected Delivery Date</strong></td>
                  <td style="padding:10px 14px;">${data.deliveryDate}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;"><strong>Expected Delivery Time</strong></td>
                  <td style="padding:10px 14px;">${data.deliveryTime}</td>
                </tr>
                <tr style="background:#f8fafc;">
                  <td style="padding:10px 14px;vertical-align:top;"><strong>Delivery Address</strong></td>
                  <td style="padding:10px 14px;">${data.deliveryAddress}</td>
                </tr>
              </table>

              <h2 style="margin:28px 0 12px;font-size:16px;color:#0f766e;">Delivery Vehicle Details</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                <tr style="background:#f8fafc;">
                  <td style="padding:10px 14px;width:40%;"><strong>Driver Name</strong></td>
                  <td style="padding:10px 14px;">${data.driverName}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;"><strong>Driver Contact</strong></td>
                  <td style="padding:10px 14px;">${data.driverPhone}</td>
                </tr>
                <tr style="background:#f8fafc;">
                  <td style="padding:10px 14px;"><strong>Vehicle Registration</strong></td>
                  <td style="padding:10px 14px;">${data.vehicleNumber}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;"><strong>Tracking / Reference</strong></td>
                  <td style="padding:10px 14px;">${data.trackingNumber}</td>
                </tr>
              </table>

              <h2 style="margin:28px 0 12px;font-size:16px;color:#0f766e;">What Happens Next?</h2>
              <ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.7;color:#334155;">
                <li>Your stock will be delivered on the scheduled date.</li>
                <li>Please ensure someone is available at the delivery address to receive the equipment.</li>
                <li>After delivery, our installation team will contact you to schedule your installation (if not already booked).</li>
              </ul>

              <p style="margin:24px 0 8px;font-size:14px;line-height:1.6;color:#334155;">
                If you have any questions regarding your delivery, please contact us.
              </p>
              <p style="margin:0;font-size:14px;line-height:1.7;color:#0f172a;">
                ${phone ? `<strong>Customer Support:</strong> ${phone}<br/>` : ""}
                ${email ? `<strong>Email:</strong> <a href="mailto:${email}" style="color:#0f766e;text-decoration:none;">${email}</a><br/>` : ""}
                ${website ? `<strong>Website:</strong> <a href="${website}" style="color:#0f766e;text-decoration:none;">${websiteDisplay}</a>` : ""}
              </p>

              <p style="margin:28px 0 0;font-size:15px;line-height:1.6;">
                Thank you for choosing <strong>${companyName}</strong>.<br/>
                We appreciate your trust and look forward to completing your installation smoothly.
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
