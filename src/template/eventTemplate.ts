import type { CompanyConfigSnapshot } from "@services/crmSettings.service";
import { getDefaultCompanyConfig } from "@services/crmSettings.service";

export const eventTemplateV1 = (type: string, content: any, cfg: CompanyConfigSnapshot) => {
    return `
         <!DOCTYPE html> <html lang="en"> 
        <head> <meta charset="UTF-8" /> 
         <title>${type} Notification</title> 
         <meta name="viewport" content="width=device-width, initial-scale=1.0" /> 
         <style> @media only screen and (max-width: 600px) { .email-container { width: 100% !important; padding: 16px !important; } .content { padding: 20px !important; } .cta-button { width: 100% !important; display: block !important; } .details-table td { font-size: 14px !important; } } </style>
         </head>
          <body style="margin: 0; padding: 0; background: linear-gradient(to right, #f4f4f7, #e2f7e1); font-family: 'Segoe UI', sans-serif;"> 
         ${content}
          <p style="font-size: 14px; color: #fcfcfc; margin-top: 10px; text-align: center;"> If you have any questions, simply reply to this email — we’re happy to help! </p> </td> </tr> <!-- Footer --> <tr> <td style="background: linear-gradient(to right, #f0fdf4, #e0ffe7); text-align: center; padding: 5px; font-size: 13px; color: #666666;border-radius: 20px;"> &copy; Copyright 2024 
                 <strong> <a style="text-decoration: none;color: #219753;" href="${cfg.website}">${cfg.nameShort}. </strong> </a>.<br /> <a style="text-decoration: none;color: #666666;" href="mailto:${cfg.email}">${cfg.email}</a> </td>
                  </tr> </table> </td> </tr> </table> </center></body> </html>
    `
}

export const eventTemplate = (client_name:any,id:any,type:any, title:any, status:any, due_date:any, link:any,event:any,assessmentLink?:string, cfg: CompanyConfigSnapshot = getDefaultCompanyConfig()) => {
    const content = ` <center> <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding: 20px 0;">
           <tr> <td align="center"> <table class="email-container" width="600" cellpadding="0" cellspacing="0" style="background: #ffffffe8; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); overflow: hidden;">
            <!-- Header --> <tr> <td style="padding: 15px 10px; text-align: center; background: linear-gradient(-180deg, #d6df22, #7cbb3b, #219753); color: black;">
             <h1 style="margin: 0; font-size: 26px;"> ${type} Notification</h1> </td> </tr> <!-- Content --> <tr>
              <td class="content" style="padding: 30px;"> <p style="font-size: 16px;color: black;"> Hello <strong style="color: #219753;">${client_name}</strong>,
               </p> <p style="font-size: 16px; line-height: 1.6;color: black;"> A new 
               <strong style="background: linear-gradient(-180deg, #7cbb3b, #219753); color: black; padding: 4px 10px; border-radius: 4px;">
               ${type}</strong> 
               has been generated for you. Here are the details: </p> <!-- Detail Table --> <table class="details-table" width="100%" cellpadding="0" cellspacing="0" style="margin: 5px 0; background: #f0fdf4; border: 1px solid #d1fae5; border-radius:0px 0px 20px 20px; font-size: 15px;"> 
               <tr style="background-color: #e6f9eb; "> <td style="padding: 5px 16px;"><strong>ID</strong></td> <td style="padding: 5px 16px; color: #065f46;">${id}</td> </tr> <tr> <td style="padding: 5px 16px;"><strong>Title</strong></td> 
               <td style="padding: 5px 16px; color: #064e3b;">${title}</td> </tr> <tr style="background-color: #e6f9eb;"> <td style="padding: 5px 16px;"><strong>Due Date</strong></td> <td style="padding: 5px 16px; color: #0f5132;">${due_date}</td>
                </tr> <tr> <td style="padding: 5px 16px;"><strong>Status</strong></td> <td style="padding: 5px 16px;"><span style="display:inline-block; background-color: #22c55e; color: black; padding: 4px 8px; border-radius: 5px;">${status}</span> </td> </tr><tr>
                <td style="padding: 5px 16px;"><strong>Event Type</strong></td>
                <td style="padding: 5px 16px;"><span style="display:inline-block; background-color: #7cbb3b; color: black; padding: 4px 8px; border-radius: 5px;">${event}</span></td></tr>
                </table> <!-- CTA --> 
                <div style="text-align: center; margin-top: 30px;"> <a href="${link}" target="_blank" style="display: inline-block; background: linear-gradient(to right, #d6df22, #7cbb3b, #219753); color: #000000ff; font-size: 16px; font-weight: bold; padding: 14px 28px; border-radius: 9999px; text-decoration: none; box-shadow: 0 4px 14px rgba(0,0,0,0.1); transition: all 0.3s;"> View ${type} </a>
                  ${
                    assessmentLink
                      ? `
                        <div style="margin-top: 18px;">
                          <a href="${assessmentLink}" target="_blank"
                            style="
                              display: inline-block;
                              background: linear-gradient(to right, #2563eb, #4f46e5, #9333ea);
                              color: white;
                              font-size: 15px;
                              font-weight: bold;
                              padding: 13px 26px;
                              border-radius: 9999px;
                              text-decoration: none;
                              box-shadow: 0 6px 18px rgba(99,102,241,0.25);
                            ">
                            📋 View Attached Assessment →
                          </a>

                          <p style="
                            margin-top: 10px;
                            font-size: 13px;
                            color: #444;
                            opacity: 0.85;">
                            This ${type} includes the related customer assessment report.
                          </p>
                        </div>
                      `
                      : ""
                  }
                </div>
                 `;
            return eventTemplateV1(type,content, cfg)
};
export const closeQuoteTemplate = (name:any, type:any = "Quote Closed", cfg: CompanyConfigSnapshot = getDefaultCompanyConfig()) => {
  const content = `
    <center>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding: 20px 0;">
        <tr>
          <td align="center">
            <table class="email-container" width="600" cellpadding="0" cellspacing="0"
              style="background: #ffffff; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); overflow: hidden;">

              <!-- Header -->
              <tr>
                <td style="padding: 15px 10px; text-align: center; 
                  background: linear-gradient(-180deg, #d6df22, #7cbb3b, #219753); color: black;">
                  <h1 style="margin: 0; font-size: 26px;">${type}</h1>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td class="content" style="padding: 30px; font-size: 16px; line-height: 1.6; color: black;">
                  
                  <p>Hello <strong style="color: #219753;">${name}</strong>,</p>

                  <p>
                    I’ll close your quote for now, but if your situation changes or rebates reopen, 
                    we’ll be happy to assist again.
                  </p>

                  <p>
                    Thank you for considering 
                    <strong style="color: #219753;">${cfg.nameShort} 🌞</strong>
                  </p>

                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </center>
  `;

  return eventTemplateV1(type, content, cfg);
};

export const otpRegSignEvents =(client_name:any,id:any,type:any,message:string,otp?:number, cfg: CompanyConfigSnapshot = getDefaultCompanyConfig())=>{
    const content = `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding: 20px 0;">
            <tr>
                <td align="center">
                    <table class="email-container" width="600" cellpadding="0" cellspacing="0"
                        style="background: #ffffffe8; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); overflow: hidden;">
                        <!-- Header -->
                        <tr>
                            <td
                                style="padding: 15px 10px; text-align: center; background: linear-gradient(-180deg, #d6df22, #7cbb3b, #219753); color: black;">
                                <h1 style="margin: 0; font-size: 26px;"> ${type} Notification</h1>
                            </td>
                        </tr> <!-- Content -->
                        <tr>
                            <td class="content" style="padding: 30px;">
                                <p style="font-size: 16px;color: black;"> Hello <strong
                                        style="color: #219753;">${client_name}</strong>,
                                </p>
                                <p style="font-size: 16px; line-height: 1.6;color: black;"> 
                                    ${message}
                                </p> <!-- Detail Table -->
                                <table class="details-table" width="100%" cellpadding="0" cellspacing="0"
                                    style="margin: 5px 0; background: #f0fdf4; border: 1px solid #d1fae5; border-radius:0px 0px 20px 20px; font-size: 15px;">
                                    <tr style="background-color: #e6f9eb; ">
                                        <td style="padding: 5px 16px;"><strong>ID</strong></td>
                                        <td style="padding: 5px 16px; color: #065f46;">${id}</td>
                                    </tr>
                                   ${
                                    otp? `<tr>
                                        <td style="padding: 5px 16px;"><strong>Otp</strong></td>
                                        <td style="padding: 5px 16px;"><span
                                                style="display:inline-block; background-color: #22c55e; color: black; padding: 4px 8px; border-radius: 5px;">${otp}</span>
                                        </td>
                                    </tr>`:''
                                   }
                                    <tr>
                                        <td style="padding: 5px 16px;"><strong>Event Type</strong></td>
                                        <td style="padding: 5px 16px;"><span
                                                style="display:inline-block; background-color: #7cbb3b; color: black; padding: 4px 8px; border-radius: 5px;">${type}</span>
                                        </td>
                                    </tr>
                                </table>
    `
            return eventTemplateV1(type,content, cfg)
}


export const salarySlipEmailTemplate = (
  employeeName: string,
  salaryMonth: string
) => `
  <div style="font-family:Arial, sans-serif; line-height:1.6">
    <h2>Salary Slip – ${salaryMonth}</h2>

    <p>Dear <b>${employeeName}</b>,</p>

    <p>
      Please find attached your salary slip for the month of
      <b>${salaryMonth}</b>.
    </p>

    <p>
      If you have any questions regarding payroll,
      please contact the HR department.
    </p>

    <br/>

    <p>
      Regards,<br/>
      <b>HR Payroll Team</b>
    </p>

    <hr/>
    <small>
      This is a system-generated email. Please do not reply.
    </small>
  </div>
`;
