import { BAD_REQUEST_CODE, SERVER_ERROR_CODE, SUCCESS_CODE } from "@constants/serverCode";
import { AuthenticatedRequest } from "@constants/common.interface";
import { ReE, ReS } from "@services/generalHelper.service";
import { sendEmail } from "@utils/email";
import { documentRepository } from "@repositories";
import { Response } from "express";
import { UploadedFile } from "express-fileupload";
import crypto from "crypto";
import fs from "fs";
import path from "path";

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

async function fileLetterPdf(opts: {
  employeeUserId: number;
  uploaderId: number;
  pdf: { buffer: Buffer; filename: string };
  letterTitle: string;
  letterType: string;
  replaceDocumentId?: string | null;
  studioSnapshot?: string | null;
}) {
  const employeeUserId = Number(opts.employeeUserId);
  const uploaderId = Number(opts.uploaderId);
  if (!employeeUserId || !uploaderId) {
    throw new Error("Employee and uploader ids are required");
  }

  const baseUploadDir = path.join(process.cwd(), "uploads", "documents");
  const userFolder = path.join(baseUploadDir, `user_${employeeUserId}`);
  if (!fs.existsSync(userFolder)) fs.mkdirSync(userFolder, { recursive: true });

  const safeFileName = opts.pdf.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storedName = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}_${safeFileName}`;
  const filePath = path.join(userFolder, storedName);
  fs.writeFileSync(filePath, opts.pdf.buffer);

  const buildDescription = (existingDesc?: any[]) => {
    const description: Array<{ key: string; value: string }> = [
      { key: "source", value: "letter_studio" },
      { key: "letter_type", value: opts.letterType || "official" },
    ];
    let snap = String(opts.studioSnapshot || "").trim();
    if (!snap && Array.isArray(existingDesc)) {
      const prev = existingDesc.find((d) => d?.key === "studio_snapshot")?.value;
      if (prev) snap = String(prev);
    }
    if (snap) {
      // Cap stored snapshot size (~500KB) to avoid oversized documents
      description.push({ key: "studio_snapshot", value: snap.slice(0, 500_000) });
    }
    return description;
  };

  const relativePath = `/uploads/documents/user_${employeeUserId}/` + storedName;

  const replaceId = String(opts.replaceDocumentId || "").trim();
  if (replaceId) {
    let existing: any = await documentRepository.findOne({ id: replaceId }, { lean: true });
    if (!existing && /^\d+$/.test(replaceId)) {
      existing = await documentRepository.findOne({ id: Number(replaceId) }, { lean: true });
    }
    if (!existing) throw new Error("Letter to update was not found");
    if (Number(existing.user_id) !== employeeUserId) {
      throw new Error("Letter does not belong to this employee");
    }

    const oldPath = path.isAbsolute(existing.file_path)
      ? existing.file_path
      : path.join(process.cwd(), String(existing.file_path || "").replace(/^\//, ""));
    if (oldPath && fs.existsSync(oldPath)) {
      try {
        fs.unlinkSync(oldPath);
      } catch {
        /* ignore stale file */
      }
    }

    await documentRepository.updateOne(
      { id: existing.id },
      {
        $set: {
          uploader_id: uploaderId,
          title: opts.letterTitle,
          description: buildDescription(existing.description),
          original_name: opts.pdf.filename,
          stored_name: storedName,
          mime_type: "application/pdf",
          size_bytes: opts.pdf.buffer.length,
          file_path: relativePath,
          updated_at: new Date(),
        },
      },
    );
    return existing.id;
  }

  const verificationHash = crypto.randomBytes(3).toString("hex").toUpperCase();
  const doc: any = await documentRepository.create({
    id: crypto.randomUUID(),
    user_id: employeeUserId,
    uploader_id: uploaderId,
    title: opts.letterTitle,
    description: buildDescription(),
    original_name: opts.pdf.filename,
    stored_name: storedName,
    mime_type: "application/pdf",
    size_bytes: opts.pdf.buffer.length,
    file_path: relativePath,
    verification_hash: verificationHash,
  });
  return doc?.id ?? null;
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

      let document_id: string | number | null = null;
      const employeeUserId = Number((req.body || {}).user_id || (req.body || {}).employee_user_id || 0);
      if (employeeUserId > 0 && req.user?.id) {
        try {
          const letterTitle =
            String((req.body || {}).letter_title || subject || "Company letter").trim() || "Company letter";
          document_id = await fileLetterPdf({
            employeeUserId,
            uploaderId: req.user.id,
            pdf,
            letterTitle,
            letterType: String((req.body || {}).letter_type || "official"),
            replaceDocumentId: String((req.body || {}).replace_document_id || "").trim() || null,
            studioSnapshot: String((req.body || {}).studio_snapshot || "").trim() || null,
          });
        } catch (fileErr) {
          console.error("Letter filed to employee documents failed:", fileErr);
        }
      }

      return ReS(res, SUCCESS_CODE, "Letter emailed successfully", {
        messageId: info?.messageId || null,
        accepted: info?.accepted || toList,
        rejected: info?.rejected || [],
        to: toList,
        filename: pdf.filename,
        document_id,
        filed_to_user_id: employeeUserId || null,
      });
    } catch (error) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }

  /** Save letter PDF to employee documents without sending email */
  async file(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user?.id) return ReE(res, BAD_REQUEST_CODE, "Unauthorized");

      const employeeUserId = Number((req.body || {}).user_id || (req.body || {}).employee_user_id || 0);
      if (!employeeUserId) return ReE(res, BAD_REQUEST_CODE, "Employee user id is required");

      const pdf = pdfBufferFromRequest(req, (req.body || {}).filename);
      if (!pdf?.buffer.length) return ReE(res, BAD_REQUEST_CODE, "PDF attachment is required");
      if (!pdf.buffer.subarray(0, 4).toString().startsWith("%PDF")) {
        return ReE(res, BAD_REQUEST_CODE, "Attachment is not a valid PDF file");
      }

      const letterTitle =
        String((req.body || {}).letter_title || "Company letter").trim() || "Company letter";
      const replaceId = String((req.body || {}).replace_document_id || "").trim() || null;
      const document_id = await fileLetterPdf({
        employeeUserId,
        uploaderId: req.user.id,
        pdf,
        letterTitle,
        letterType: String((req.body || {}).letter_type || "official"),
        replaceDocumentId: replaceId,
        studioSnapshot: String((req.body || {}).studio_snapshot || "").trim() || null,
      });

      return ReS(res, SUCCESS_CODE, replaceId ? "Letter updated on employee profile" : "Letter saved to employee profile", {
        document_id,
        filed_to_user_id: employeeUserId,
        filename: pdf.filename,
        replaced: Boolean(replaceId),
      });
    } catch (error) {
      console.error(error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
    }
  }
}

export default new LetterStudioController();
