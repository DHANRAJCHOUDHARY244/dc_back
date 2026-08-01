import type { CompanyConfigSnapshot } from "@services/crmSettings.service";
import { getDefaultCompanyConfig } from "@services/crmSettings.service";

export const advertisingEmailTemplate = (name: string, cfg: CompanyConfigSnapshot = getDefaultCompanyConfig()) => {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${cfg.nameShort}</title>
    <style>
      body {
        background-color: #f4f4f7;
        font-family: "Segoe UI", Arial, sans-serif;
        color: #333;
        margin: 0;
        padding: 0;
      }

      .container {
        max-width: 600px;
        background: #ffffff;
        margin: 30px auto;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.05);
      }

      .header {
        text-align: center;
        padding: 20px;
        background: #d1d1d1;
      }

      .header img {
        max-width: 180px;
      }

      .content {
        padding: 30px;
        line-height: 1.6;
      }

      .cta {
        display: inline-block;
        margin-top: 16px;
        background: #219753;
        color: #fff !important;
        text-decoration: none;
        padding: 12px 24px;
        border-radius: 6px;
        font-weight: 600;
        transition: background 0.3s ease;
      }

      .cta:hover {
        background: #1a7a43;
      }

      .footer {
        font-size: 13px;
        text-align: center;
        color: #777;
        background: #f9fafb;
        padding: 15px;
      }

      .footer a {
        color: #219753;
        text-decoration: none;
      }

      @media only screen and (max-width: 600px) {
        .content {
          padding: 20px;
        }
      }
    </style>
  </head>

  <body>
    <div class="container">
      <div class="header">
        <img src="${cfg.emailLogoUrl || cfg.companyLogoUrl}" alt="${cfg.nameShort}" />
      </div>

      <div class="content">
        <p>Hi <strong>${name || "there"}</strong>,</p>

        <p>
          At <strong>${cfg.nameShort}</strong>, we help Australian households lower their energy costs through efficient and reliable 
          <strong>solar, battery, and heat pump</strong> solutions.
        </p>

        <p>
          If you’re planning to upgrade your system or explore available rebates, our team would be happy to offer a 
          <strong>free consultation</strong> — no obligation, just expert advice tailored to your home.
        </p>

        <p style="text-align:center;">
          <a href="${cfg.contactUsPageUrl}" class="cta" target="_blank">Book Free Consultation</a>
        </p>

        <p style="margin-top:20px;">
          Warm regards,<br/>
          <strong>${cfg.nameShort} Team</strong><br/>
          <a href="mailto:${cfg.email}">${cfg.email}</a> | 
          <a href="tel:+61300134410">1300 134 410</a>
        </p>
      </div>

      <div class="footer">
        <p>${cfg.nameShort} | ${cfg.address}</p>
        <p><a href="${cfg.website}">${cfg.websiteDisplay}</a></p>
        <p>
          You’re receiving this message because you’ve interacted with ${cfg.nameShort}.  
          <a href="#">Unsubscribe</a> to stop receiving updates.
        </p>
      </div>
    </div>
  </body>
  </html>
  `;
};



export const advertisingFeedBackEmailTemplate = (name: string, cfg: CompanyConfigSnapshot = getDefaultCompanyConfig()) => {
    return `
    <!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <title>${cfg.nameShort} - Feedback & Referral</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #f4f4f7;
      font-family: 'Segoe UI', sans-serif;
    }

    .email-container {
      max-width: 650px;
      margin: 20px auto;
      background: #ffffff;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.15);
      width: 100%;
    }

    .header {
      text-align: center;
      padding: 25px;
      background: linear-gradient(135deg, #000000, #1a1a1a);
    }

    .header img {
      max-width: 220px;
      height: auto;
    }

    .content {
      padding: 30px;
      color: #333333;
      background: linear-gradient(180deg, #ffffff, #f9fafb);
      text-align: left;
    }

    .content h2 {
      font-size: 22px;
      margin-bottom: 15px;
      color: #219753;
      text-align: center;
    }

    .content p {
      font-size: 16px;
      line-height: 1.7;
      margin: 12px 0;
    }

    .cta-button {
      display: inline-block;
      background: linear-gradient(to right, #d6df22, #7cbb3b, #219753);
      color: #fff !important;
      font-size: 16px;
      font-weight: bold;
      padding: 14px 32px;
      border-radius: 50px;
      text-decoration: none;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
      margin: 10px 5px;
      transition: all 0.3s ease;
    }

    .cta-button:hover {
      opacity: 0.95;
      transform: scale(1.05);
    }

    .highlight {
      color: #219753;
      font-weight: bold;
    }

    .referral-box {
      margin-top: 25px;
      background: linear-gradient(135deg, #e8f9f0, #f4ffe9);
      padding: 18px 20px;
      border-radius: 12px;
      font-size: 15px;
      text-align: center;
      color: #333;
    }

    .footer {
      background: #111111;
      text-align: center;
      padding: 20px;
      font-size: 13px;
      color: #bbbbbb;
      line-height: 1.7;
    }

    .footer a {
      text-decoration: none;
      color: #7cbb3b;
      font-weight: 500;
    }

    /* ✅ Mobile Fixes */
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 95% !important;
        margin: 10px auto !important;
      }

      .content {
        padding: 20px !important;
        text-align: center !important;
      }

      .content h2 {
        font-size: 20px !important;
      }

      .content p {
        font-size: 15px !important;
      }

      .cta-button {
        width: 80% !important;
        display: block !important;
        margin: 12px auto !important;
      }

      .referral-box {
        font-size: 14px !important;
        padding: 15px !important;
      }
    }
  </style>
</head>

<body>
  <center>
    <div class="email-container">
      <!-- Header -->
      <div class="header">
        <img src="${cfg.emailLogoUrl || cfg.companyLogoUrl}"
          alt="${cfg.nameShort} Logo" />
      </div>

      <!-- Content -->
      <div class="content">
        <h2>🌞 We’d Love Your Feedback!</h2>
        <p>Hi <strong class="highlight">${name}</strong>,</p>

        <p>Thank you for choosing <strong>${cfg.nameShort}</strong> for your
          <span class="highlight">Solar / Battery / Heat pump /Aircon</span>.
          We’re delighted to have you as our customer!</p>

        <p>We’d love to hear your thoughts — it only takes a minute:</p>
        <center>
          <a href="https://www.google.com/maps/search/?api=1&query=Som%27s+Energy+Melbourne+reviews" class="cta-button" target="_blank">⭐ Leave a Quick Review</a>
        </center>

        <!-- Referral Box -->
        <div class="referral-box">
          <p>💰 <strong>Earn $200 Bonus!</strong><br>
            Refer us to your friends or family.  
            Once they install with us, you’ll get a <strong>$200 reward</strong>. 🎉
          </p>
        </div>
          <center>
          <a href="${cfg.referFriendEarnBonusPageUrl}" class="cta-button" target="_blank">⭐ Refer And Earn</a>
        </center>
        <!-- Contact -->
        <center style="margin-top: 20px;">
          <a href="https://wa.me/61480582628" class="cta-button" target="_blank">💬 WhatsApp Us</a>
          <a href="tel:1300134410" class="cta-button">📞 Call 1300 134 410</a>
        </center>

        <p style="margin-top: 30px; text-align: center;">
          Thanks again,<br />
          <strong style="color:#219753;">Team ${cfg.nameShort}</strong>
        </p>
      </div>

      <!-- Footer -->
      <div class="footer">
        &copy; 2024 <a href="${cfg.website}" target="_blank">${cfg.nameShort}</a>  
        <br> South Morang VIC 3752 | 
        <a href="mailto:${cfg.email}">${cfg.email}</a> | 
        <a href="tel:${cfg.phoneNumber}">${cfg.phoneNumber}</a>
      </div>
    </div>
  </center>
</body>

</html>
`
}
