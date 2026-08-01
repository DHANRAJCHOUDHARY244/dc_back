export const closeQuoteEmailTemplate = ({name,link,id,due_date}) => {
    return `
   <!DOCTYPE html>
   <html lang="en">
   <head>
   <meta charset="UTF-8" />
   <title>Close Quote Notification</title>
   <meta name="viewport" content="width=device-width, initial-scale=1.0" />
   <style>
     @media only screen and (max-width: 600px) {
       .email-container { width: 100% !important; padding: 16px !important; }
       .content { padding: 20px !important; }
       .details-table td { font-size: 14px !important; }
     }
   </style>
   </head>
   <body style="margin: 0; padding: 0; background: linear-gradient(to right, #f4f4f7, #e2f7e1); font-family: 'Segoe UI', sans-serif;">
   <center>
     <table width="100%" cellpadding="0" cellspacing="0" style="padding: 20px 0;">
       <tr>
         <td align="center">   
           <table class="email-container" width="600" cellpadding="0" cellspacing="0"
             style="background: #ffffff; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); overflow: hidden;">
             <tr>
               <td style="padding: 15px 10px; text-align: center;
                   background: linear-gradient(-180deg, #d6df22, #7cbb3b, #219753);">
                 <h1 style="margin: 0; font-size: 26px; color: black;">
                   Close Quote Notification
                 </h1>
               </td>
             </tr>
             <tr>
               <td class="content" style="padding: 30px; font-size: 16px; line-height: 1.6; color: black;">
                 <p>Hello <strong style="color: #219753;">${name}</strong>,</p>
                 <p>
                  Your quote is still pending. The Victoria solar rebate is open, but spots are filling fast  delaying may risk missing the rebate.
                 </p>
   <p>Your quote is valid for 7 days.
   </p>
                 <p>
                   If you wish to proceed, please <b> <a href="${link}" target="_blank" style="color: #219753;"> ACCEPT YOUR QUOTE </a></b>and we’ll secure your rebate and price.
                 </p>  
                 <p style="margin-top: 20px; font-weight: bold; color: #219753;">Quote Details:</p>   
                 <table class="details-table" width="100%" cellpadding="0" cellspacing="0"
                   style="margin: 5px 0; background: #f0fdf4; border: 1px solid #d1fae5; border-radius: 0 0 20px 20px; font-size: 15px;">                  
                   <tr style="background-color: #e6f9eb;">
                     <td style="padding: 8px 16px;"><strong>ID</strong></td>
                     <td style="padding: 8px 16px; color: #065f46;">${id}</td>
                   </tr>   
                   <tr style="background-color: #e6f9eb;">
                     <td style="padding: 8px 16px;"><strong>Due Date</strong></td>
                     <td style="padding: 8px 16px; color: #0f5132;">${due_date}</td>
                   </tr>  
                   <tr style="background-color: #e6f9eb;">
                     <td style="padding: 8px 16px;"><strong>Event Type</strong></td>
                     <td style="padding: 8px 16px;">
                       <span style="background-color: #ff0404; color: black; padding: 4px 8px; border-radius: 5px;">
                         Close Quote
                       </span>
                     </td>
                   </tr>   
                 </table>
                 <div style="text-align: center; margin-top: 30px;">
                   <a href="${link}" target="_blank"
                     style="display: inline-block; background: linear-gradient(to right, #d6df22, #7cbb3b, #219753);
                     color: black; font-size: 16px; font-weight: bold; padding: 14px 28px; border-radius: 9999px;
                     text-decoration: none; box-shadow: 0 4px 14px rgba(0,0,0,0.1);">
                     View Quote
                   </a>
                 </div>
               </td>
             </tr>
           </table>
           <p style="font-size: 14px; color: #000000; margin-top: 10px; text-align: center;">
             If you have any questions, simply reply to this email — we’re happy to help!
           </p>
         </td>
       </tr>
     </table>
   </center>
   </body>
   </html>
    `
}