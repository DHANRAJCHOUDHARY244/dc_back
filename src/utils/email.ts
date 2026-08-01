import logger from "./pino";
import { emailClient, marketingEmailClient } from "@config/email";

interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export async function sendEmail(
  to: string,
  subject: string,
  bodyHtml: string,
  cc?: string[],
  bcc?: string[],
  attachments?: EmailAttachment[]
) {
  try {
    const params: any = {
      from: process.env.EMAIL_USERNAME,
      to,
      subject,
      html: bodyHtml,
    };

    if (cc?.length) params.cc = cc;
    if (bcc?.length) params.bcc = bcc;
    if (attachments?.length) params.attachments = attachments;

    const response = await emailClient.sendMail(params);

    logger.info(
      `Email sent → ${to} | CC: ${cc?.join(", ") || "none"} | BCC: ${
        bcc?.join(", ") || "none"
      }`
    );

    return response;
  } catch (error) {
    logger.error("Error sending email", error);
    throw error;
  }
}


export async function marketingSendEmail(
  to: string,
  subject: string,
  bodyHtml: string
) {
  try {
    const params = {
      from: process.env.MARKETING_EMAIL_USERNAME,
      to: to,
      subject: subject,
      html: bodyHtml,
    };
    const response =  await marketingEmailClient.sendMail(params);
    logger.info(` Email sent to ${to} | MessageId: ${response.MessageId}`);
    return response;
  } catch (error) {
    logger.error(` Error sending email: ${error}`);
  }
}
