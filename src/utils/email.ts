import logger from "./pino";
import { emailClient, marketingEmailClient } from "@config/email";

interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
  contentDisposition?: "attachment" | "inline";
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
    const fromAddr = String(process.env.EMAIL_USERNAME || "").trim();
    const params: any = {
      from: fromAddr.includes("<") ? fromAddr : `"SOMS Energy" <${fromAddr}>`,
      to,
      subject,
      html: bodyHtml,
      text: htmlToPlainText(bodyHtml),
      replyTo: fromAddr,
    };

    if (cc?.length) params.cc = cc;
    if (bcc?.length) params.bcc = bcc;
    if (attachments?.length) params.attachments = attachments;

    const response = await emailClient.sendMail(params);
    const accepted = Array.isArray(response.accepted) ? response.accepted : [];
    const rejected = Array.isArray(response.rejected) ? response.rejected : [];

    logger.info(
      `Email sent → ${to} | accepted: ${accepted.join(", ") || "none"} | rejected: ${
        rejected.join(", ") || "none"
      } | id: ${response.messageId || "n/a"} | smtp: ${response.response || "n/a"}`
    );

    if (!accepted.length) {
      throw new Error(
        `Mail server did not accept any recipients${rejected.length ? ` (rejected: ${rejected.join(", ")})` : ""}`,
      );
    }

    return response;
  } catch (error) {
    logger.error("Error sending email", error);
    throw error;
  }
}

function htmlToPlainText(html: string): string {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
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
