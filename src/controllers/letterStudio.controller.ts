import { BAD_REQUEST_CODE, SERVER_ERROR_CODE, SUCCESS_CODE } from "@constants/serverCode";
import { AuthenticatedRequest } from "@constants/common.interface";
import { ReE, ReS } from "@services/generalHelper.service";
import { sendEmail } from "@utils/email";
import { Response } from "express";
import { UploadedFile } from "express-fileupload";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseAddressList(value: unknown): string[] {
  return String(value || "")
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter((s) => EMAIL_RE.test(s));
}

function safePdfFilename(name: unknown): string {
  let file = String(name || "official-letter.pdf")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .trim();
  if (!file.toLowerCase().endsWith(".pdf")) file = `${file}.pdf`;
  return file || "official-letter.pdf";
}

function pdfBufferFromRequest(req: AuthenticatedRequest, filenameHint: string): { buffer: Buffer; filename: string } | null {
  const files = req.files as { pdf?: UploadedFile | UploadedFile[] } | undefined;
  const uploaded = files?.pdf;
  const file = Array.isArray(uploaded) ? uploaded[0] : uploaded;
  if (file?.data) {
    const buffer = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data);
    const filename = safePdfFilename(file.name || filenameHint);
    return { buffer, filename };
  }

  const pdf_base64 = (req.body || {}).pdf_base64;
  if (pdf_base64) {
    const raw = String(pdf_base64).replace(/^data:application\/pdf;base64,/, "").replace(/\s/g, "");
    const buffer = Buffer.from(raw, "base64");
    return { buffer, filename: safePdfFilename(filenameHint) };
  }

  return null;
}

class LetterStudioController {
  async send(req: AuthenticatedRequest, res: Response) {
    try {
      const { to, cc, subject, html, filename } = req.body || {};
      if (!to || !subject || !html) {
        return ReE(res, BAD_REQUEST_CODE, "to, subject and html are required");
      }

      const toList = parseAddressList(to);
      if (!toList.length) return ReE(res, BAD_REQUEST_CODE, "Enter a valid recipient email");

      const pdf = pdfBufferFromRequest(req, filename);
      if (!pdf?.buffer.length) return ReE(res, BAD_REQUEST_CODE, "PDF attachment is required");
      if (!pdf.buffer.subarray(0, 4).toString().startsWith("%PDF")) {
        return ReE(res, BAD_REQUEST_CODE, "Attachment is not a valid PDF file");
      }

      const ccList = parseAddressList(cc);

      const info = await sendEmail(
        toList.join(", "),
        String(subject).trim(),
        String(html),
        ccList.length ? ccList : undefined,
        undefined,
        [
          {
            filename: pdf.filename,
            content: pdf.buffer,
            contentType: "application/pdf",
            contentDisposition: "attachment",
          },
        ],
      );

      return ReS(res, SUCCESS_CODE, "Letter emailed successfully", {
        messageId: info?.messageId || null,
        accepted: info?.accepted || toList,
        rejected: info?.rejected || [],
        to: toList,
        filename: pdf.filename,
      });
    } catch (error) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }
}

export default new LetterStudioController();
