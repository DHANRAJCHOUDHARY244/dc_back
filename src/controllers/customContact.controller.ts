import {
  BAD_REQUEST_CODE,
  FORBIDDEN_CODE,
  NO_CONTENT,
  SERVER_ERROR_CODE,
  SUCCESS_CODE,
} from "@constants/serverCode";
import { customContactRepository, customContactDocumentRepository, userRepository } from "@repositories";
import { Request, Response } from "express";
import {
  bypassTokenCreation,
  ReE,
  ReS,
  verifyBypassToken,
} from "@services/generalHelper.service";
import {
  AuthenticatedRequest,
  DocumentsAuthenticatedRequest,
} from "@constants/common.interface";
import { UploadCategory } from "@constants/common.enum";
import {
  deleteFileFromStorage,
  getRelativeFilePath,
  uploadFiles,
} from "@utils/fileUpload.helper";
import { sendEmail } from "@utils/email";
import { eventTemplate } from "@template/eventTemplate";
import { EVENT_TASK_TYPE } from "@constants/socket.constants";
import notificationController from "./notification.controller";
import { getCompanyConfig } from "@services/crmSettings.service";

type ContactEmailType = "CREATED" | "FOLLOW_UP" | "SIGNED";

const contactPopulate = [
  { path: "installer", select: "id name email mobile_no address" },
  { path: "sended_by", select: "id name email mobile_no address" },
];

const buildContactPdfEmailTemplate = ({
  recipientName,
  agreement,
  senderName,
  cfg,
}: {
  recipientName: string;
  agreement: any;
  senderName?: string;
  cfg: Awaited<ReturnType<typeof getCompanyConfig>>;
}) => {
  const agreementId = agreement?.id || "";
  const address = agreement?.address || "-";
  const phone = agreement?.phone || "-";
  const email = agreement?.email || "-";

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <div style="max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="margin: 0 0 12px; color: #111827;">Contract PDF</h2>
        <p style="margin: 0 0 12px;">Hello ${recipientName},</p>
        <p style="margin: 0 0 12px;">
          Please find the contract PDF attached. If you have any questions, reply to this email.
        </p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px;">
          <p style="margin: 0 0 6px;"><strong>Contract #:</strong> ${agreementId}</p>
          <p style="margin: 0 0 6px;"><strong>Address:</strong> ${address}</p>
          <p style="margin: 0 0 6px;"><strong>Phone:</strong> ${phone}</p>
          <p style="margin: 0;"><strong>Email:</strong> ${email}</p>
        </div>
        <p style="margin: 16px 0 0;">
          Regards,<br />
          ${senderName || `${cfg.nameShort} Team`}
        </p>
      </div>
    </div>
  `;
};

const buildContactLink = (agreementId: number, bypassToken?: string | null) => {
  const tokenPart = bypassToken ? `/?bypass_token=${bypassToken}` : "";
  return `${process.env.FRONT_URL}/#/custom-contact/${agreementId}${tokenPart}`;
};

const resolveContactRecipient = (agreement: any, user: any) => {
  return {
    name: agreement?.name || user?.name || agreement?.email || user?.email || "User",
    email: agreement?.email || user?.email,
  };
};

const ensureContactBypassToken = async (agreement: any) => {
  if (agreement?.bypass_token) return agreement.bypass_token;
  const bypass_token = bypassTokenCreation({
    id: agreement.installer_id,
    agreement_id: agreement.id,
  });
  await customContactRepository.updateById(agreement.id, { $set: { bypass_token } });
  return bypass_token;
};

const sendContactEmail = async ({
  agreement,
  user,
  type,
  cc = [],
  bcc = [],
}: {
  agreement: any;
  user: any;
  type: ContactEmailType;
  cc?: string[];
  bcc?: string[];
}) => {
  const { name, email } = resolveContactRecipient(agreement, user);
  if (!email) return;

  const cfg = await getCompanyConfig();
  const bypassToken = await ensureContactBypassToken(agreement);
  const link = buildContactLink(agreement.id, bypassToken);
  const title = `Contract #${agreement.id}`;
  const status = agreement.status || "draft";
  const dueDate = agreement.created_at
    ? new Date(agreement.created_at).toISOString().split("T")[0]
    : "";

  const event =
    type === "FOLLOW_UP" ? EVENT_TASK_TYPE.UPDATED : EVENT_TASK_TYPE.CREATED;
  const subject =
    type === "FOLLOW_UP"
      ? `Follow Up: ${title}`
      : "Your Contract is Ready";

  const htmlTemplate = eventTemplate(
    name,
    agreement.id,
    "CONTRACT",
    title,
    status,
    dueDate,
    link,
    event,
    undefined,
    cfg
  );

  await sendEmail(email, subject, htmlTemplate, cc, bcc);
};

const createContactNotification = async ({
  userId,
  agreement,
  user,
  sender,
  type,
  message,
}: {
  userId: number;
  agreement: any;
  user: any;
  sender: any;
  type: ContactEmailType;
  message?: string;
}) => {
  const bypassToken = await ensureContactBypassToken(agreement);
  const route = buildContactLink(agreement.id, bypassToken);
  const action = type === "FOLLOW_UP" ? "Follow-up sent for" : "New";
  await notificationController.createNotification({
    userId,
    message: message || `${action} Contract #${agreement.id}.`,
    route,
    meta: {
      partyId: agreement.installer_id,
      partyName: user?.name || agreement?.name,
      type: "CUSTOM_CONTACT",
      senderName: sender?.name,
      role: sender?.role,
    },
  });
};

class CustomContactController {
  async saveContact(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        name,
        id_type,
        id_value,
        phone,
        email,
        address,
        job_type = "CONTRACT",
        html_content,
        terms_conditions = [],
      } = req.body;
      const user_id = req.body.user_id || req.body.installer_id;

      if (!user_id || !html_content) {
        return ReE(
          res,
          BAD_REQUEST_CODE,
          "user_id and html_content are required"
        );
      }

      const user: any = await userRepository.findById(Number(user_id), { lean: true });
      if (!user) return ReE(res, NO_CONTENT, "User not found");

      const existing = await customContactRepository.findOne({
        installer_id: user_id,
      });

      const isNewAgreement = !existing;
      let agreement: any;

      if (existing) {
        agreement = await customContactRepository.updateById(Number(existing.id), {
          $set: {
            name,
            id_type: id_type || null,
            id_value: id_value || null,
            phone,
            email,
            address,
            job_type: job_type || "CONTRACT",
            html_content,
            sender: req.user.id,
            terms_conditions,
          },
        });
      } else {
        agreement = await customContactRepository.create({
          installer_id: user_id,
          name,
          id_type: id_type || null,
          id_value: id_value || null,
          phone,
          email,
          address,
          job_type: job_type || "CONTRACT",
          html_content,
          sender: req.user.id,
          terms_conditions,
        });
        const bypass_token = bypassTokenCreation({
          id: user_id,
          agreement_id: agreement.id,
        });
        agreement = await customContactRepository.updateById(agreement.id, {
          $set: { bypass_token },
        });
      }

      const response = ReS(res, SUCCESS_CODE, "Contract saved", agreement);

      if (isNewAgreement) {
        (async () => {
          try {
            await createContactNotification({
              userId: req.user.id,
              agreement,
              user,
              sender: req.user,
              type: "CREATED",
            });
            await sendContactEmail({
              agreement,
              user,
              type: "CREATED",
            });
          } catch (err) {
            console.error("Custom contact email/notification failed:", err);
          }
        })();
      }

      return response;
    } catch (err) {
      console.error(err);
      return ReE(res, SERVER_ERROR_CODE, "Failed to save contract");
    }
  }

  async updateContact(req: AuthenticatedRequest, res: Response) {
    const token: any = req.params.token;
    const { id: user_id, agreement_id } = verifyBypassToken(token);
    if (!user_id || !agreement_id)
      return ReE(res, FORBIDDEN_CODE, "Unauthorized access");
    try {
      const { name, id_type, id_value, phone, address, html_content, terms_conditions } =
        req.body;

      if (!name || !html_content || !phone || !address) {
        return ReE(
          res,
          BAD_REQUEST_CODE,
          "Required fields [name, phone, address, html_content] missing"
        );
      }

      const existing: any = await customContactRepository.findOne({
        installer_id: user_id,
        id: agreement_id,
      });
      if (!existing) return ReE(res, NO_CONTENT, "Contract not found");

      const data = await customContactRepository.updateById(agreement_id, {
        $set: {
          name,
          id_type: id_type || null,
          id_value: id_value || null,
          phone,
          address,
          html_content,
          sender: req.user.id,
          terms_conditions,
        },
      });

      return ReS(res, SUCCESS_CODE, "Contract saved", data);
    } catch (err) {
      console.error(err);
      return ReE(res, SERVER_ERROR_CODE, "Failed to save contract");
    }
  }

  async signContact(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const { id: user_id, agreement_id } = req.user;
      const signature = req.files?.signature;

      if (!agreement_id || !signature) {
        return ReE(res, BAD_REQUEST_CODE, "Signature required");
      }

      const agreement: any = await customContactRepository.findOne(
        { id: agreement_id, installer_id: user_id },
        { populate: { path: "sended_by", select: "id name email mobile_no address" } },
      );

      if (!agreement) return ReE(res, NO_CONTENT, "Contract not found");
      if (agreement.status === "signed") {
        return ReE(res, BAD_REQUEST_CODE, "Contract already signed");
      }

      const uploaded: any = await uploadFiles({
        category: UploadCategory.INSTALLER_SIGNATURE,
        files: signature,
        entityId: agreement_id,
        allowedTypes: ["image/png", "image/jpeg"],
        maxSizeMB: 5,
      });

      const updatedAgreement = await customContactRepository.updateById(agreement_id, {
        $set: {
          signature_url: uploaded.url,
          accepted: true,
          accepted_at: new Date(),
          accepted_ip: req.ip,
          status: "signed",
        },
      });

      if (agreement?.sended_by) {
        await createContactNotification({
          userId: agreement.sended_by.id,
          agreement: updatedAgreement,
          user: req.user,
          sender: agreement?.sended_by?.name,
          type: "SIGNED",
          message: `Contract #${agreement.id} has been signed.`,
        });
      }

      return ReS(res, SUCCESS_CODE, "Contract signed", updatedAgreement);
    } catch (err) {
      console.error(err);
      return ReE(res, SERVER_ERROR_CODE, "Failed to sign contract");
    }
  }

  async uploadContactDocument(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const { document_type } = req.body;
      const { id: user_id, agreement_id } = req.user;
      const file = req.files?.document;

      if (!user_id || !agreement_id) {
        return ReE(res, FORBIDDEN_CODE, "Unauthorized access");
      }
      if (!document_type || !file) {
        return ReE(res, BAD_REQUEST_CODE, "Missing fields");
      }

      const agreement: any = await customContactRepository.findOne({
        id: agreement_id,
        installer_id: user_id,
      });
      if (!agreement) {
        return ReE(res, NO_CONTENT, "Contract not found or access denied");
      }

      const uploaded: any = await uploadFiles({
        category: UploadCategory.INSTALLER_DOCUMENT,
        files: file,
        entityId: user_id,
        maxSizeMB: 20,
      });

      const doc = await customContactDocumentRepository.create({
        installer_id: user_id,
        agreement_id,
        document_type,
        url: uploaded.url,
      } as any);

      if (agreement?.sender) {
        await createContactNotification({
          userId: agreement.sender,
          agreement,
          user: req.user,
          sender: req.user,
          type: "CREATED",
          message: `Document uploaded for Contract #${agreement.id}.`,
        });
      }

      return ReS(res, SUCCESS_CODE, "Document uploaded successfully", doc);
    } catch (err) {
      console.error("uploadContactDocument error:", err);
      return ReE(res, SERVER_ERROR_CODE, "Failed to upload document");
    }
  }

  async getContact(req: AuthenticatedRequest, res: Response) {
    try {
      const { id, agreement_id } = req.user;
      if (agreement_id && !id)
        return ReE(res, FORBIDDEN_CODE, "Unauthorized access");

      const agreement: any = await customContactRepository.findOne(
        { id: agreement_id, installer_id: id },
        {
          populate: contactPopulate,
          sort: { created_at: -1 },
          lean: true,
        },
      );

      if (!agreement) return ReE(res, NO_CONTENT, "No contract found");

      const documents = await customContactDocumentRepository.find(
        { installer_id: agreement.installer_id },
        { select: "document_type url id", lean: true },
      );

      return ReS(res, SUCCESS_CODE, "Contract fetched", {
        ...agreement,
        documents,
      });
    } catch (err) {
      console.error(err);
      return ReE(res, SERVER_ERROR_CODE, "Failed to fetch contract");
    }
  }

  async getContactDocuments(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const agreement: any = await customContactRepository.findById(id, {
        select: "id installer_id",
        lean: true,
      });
      if (!agreement) return ReE(res, NO_CONTENT, "Contract not found");

      const documents = await customContactDocumentRepository.find(
        { installer_id: agreement.installer_id },
        {
          select: "document_type url",
          sort: { created_at: -1 },
          lean: true,
        },
      );

      return ReS(
        res,
        SUCCESS_CODE,
        "Documents fetched successfully",
        documents
      );
    } catch (err) {
      console.error("getContactDocuments error:", err);
      return ReE(res, SERVER_ERROR_CODE, "Failed to fetch documents");
    }
  }

  async getAllContacts(req: Request, res: Response) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        installer_id,
        user_id,
        from_date,
        to_date,
        sort_by = "created_at",
        sort_order = "DESC",
      } = req.body;

      const safeLimit = Math.min(Number(limit), 50);
      const safePage = Math.max(Number(page), 1);
      const skip = (safePage - 1) * safeLimit;

      const match: Record<string, unknown> = { deleted_at: null };
      if (from_date || to_date) {
        match.created_at = {};
        if (from_date) (match.created_at as any).$gte = new Date(from_date);
        if (to_date) (match.created_at as any).$lte = new Date(to_date);
      }

      const installerMatch: Record<string, unknown> = { "installer.deleted_at": null };
      if (search) {
        installerMatch.$or = [
          { "installer.name": { $regex: search, $options: "i" } },
          { "installer.email": { $regex: search, $options: "i" } },
        ];
      }
      if (user_id || installer_id) {
        installerMatch["installer.id"] = user_id || installer_id;
      }

      const sortDir = sort_order.toUpperCase() === "ASC" ? 1 : -1;

      const [rows, countResult] = await Promise.all([
        customContactRepository.aggregateRaw([
          { $match: match },
          {
            $lookup: {
              from: "users",
              localField: "installer_id",
              foreignField: "id",
              as: "installer",
            },
          },
          { $unwind: "$installer" },
          {
            $lookup: {
              from: "users",
              localField: "sender",
              foreignField: "id",
              as: "sended_by",
            },
          },
          { $unwind: { path: "$sended_by", preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: "custom_contact_documents",
              localField: "installer_id",
              foreignField: "installer_id",
              as: "documents",
            },
          },
          { $match: installerMatch },
          { $project: { terms_conditions: 0 } },
          { $sort: { [sort_by]: sortDir } },
          { $skip: skip },
          { $limit: safeLimit },
        ]),
        customContactRepository.aggregateRaw([
          { $match: match },
          {
            $lookup: {
              from: "users",
              localField: "installer_id",
              foreignField: "id",
              as: "installer",
            },
          },
          { $unwind: "$installer" },
          { $match: installerMatch },
          { $count: "total" },
        ]),
      ]);

      const count = countResult[0]?.total ?? 0;

      if (!rows.length) {
        return ReS(res, SUCCESS_CODE, "No contracts found", {
          meta: {
            totalItems: count,
            totalPages: Math.ceil(count / safeLimit),
            currentPage: safePage,
            limit: safeLimit,
          },
          data: [],
        });
      }

      return ReS(res, SUCCESS_CODE, "Contracts fetched successfully", {
        meta: {
          totalItems: count,
          totalPages: Math.ceil(count / safeLimit),
          currentPage: safePage,
          limit: safeLimit,
        },
        data: rows,
      });
    } catch (err) {
      console.error("getAllContacts error:", err);
      return ReE(res, SERVER_ERROR_CODE, "Failed to fetch contracts");
    }
  }

  async sendContactFollowUp(req: AuthenticatedRequest, res: Response) {
    try {
      const { agreementId, cc = [], bcc = [] } = req.body;
      if (!agreementId) {
        return ReE(res, BAD_REQUEST_CODE, "agreementId is required");
      }

      const agreement: any = await customContactRepository.findOne(
        { id: agreementId },
        { populate: { path: "installer", select: "id name email" } },
      );
      if (!agreement) return ReE(res, NO_CONTENT, "Contract not found");

      ReS(res, SUCCESS_CODE, "Follow-up email sent successfully.");

      await sendContactEmail({
        agreement,
        user: agreement.installer,
        type: "FOLLOW_UP",
        cc,
        bcc,
      });

      await createContactNotification({
        userId: req.user.id,
        agreement,
        user: agreement.installer,
        sender: req.user,
        type: "FOLLOW_UP",
      });
      return;
    } catch (err: any) {
      console.error("sendContactFollowUp error:", err);
      return ReE(
        res,
        SERVER_ERROR_CODE,
        err.message || "Failed to send follow-up"
      );
    }
  }

  async sendContactPdf(req: AuthenticatedRequest, res: Response) {
    try {
      const { agreementId, pdfBase64, fileName } = req.body;
      const pdfFile: any = (req as any).files?.pdf;

      if (!agreementId || (!pdfFile && !pdfBase64)) {
        return ReE(
          res,
          BAD_REQUEST_CODE,
          "agreementId and pdf file (or pdfBase64) are required"
        );
      }

      const agreement: any = await customContactRepository.findOne(
        { id: agreementId },
        { populate: contactPopulate },
      );
      if (!agreement) return ReE(res, NO_CONTENT, "Contract not found");

      let pdfBuffer: Buffer;
      let attachmentName = fileName || `contract-${agreement.id}.pdf`;

      if (pdfFile) {
        const fileItem = Array.isArray(pdfFile) ? pdfFile[0] : pdfFile;
        pdfBuffer = fileItem.data;
        attachmentName = attachmentName || fileItem.name;
      } else {
        const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
        pdfBuffer = Buffer.from(base64Data, "base64");
      }

      const recipientEmail = agreement?.email || agreement?.installer?.email;
      const recipientName = agreement?.name || agreement?.installer?.name || "User";
      const senderEmail = agreement?.sended_by?.email;
      if (!recipientEmail) return ReE(res, NO_CONTENT, "Recipient email not found");

      const attachments = [
        {
          filename: attachmentName,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ];

      const cfg = await getCompanyConfig();
      const htmlTemplate = buildContactPdfEmailTemplate({
        recipientName,
        agreement,
        senderName: agreement?.sended_by?.name || req.user?.name,
        cfg,
      });
      const ccList = senderEmail ? [senderEmail] : [];

      await sendEmail(
        recipientEmail,
        `Contract PDF #${agreement.id}`,
        htmlTemplate,
        ccList,
        [],
        attachments
      );

      return ReS(res, SUCCESS_CODE, "PDF sent successfully");
    } catch (err: any) {
      console.error("sendContactPdf error:", err);
      return ReE(res, SERVER_ERROR_CODE, err.message || "Failed to send PDF");
    }
  }

  async deleteContactDocument(req: AuthenticatedRequest, res: Response) {
    try {
      const docId = Number(req.params.id);
      const { id: user_id, agreement_id } = req.user;
      if (agreement_id && !user_id)
        return ReE(res, FORBIDDEN_CODE, "Unauthorized access");
      if (!agreement_id || !docId) {
        return ReE(
          res,
          BAD_REQUEST_CODE,
          "Agreement ID and Document ID are required"
        );
      }

      const agreement: any = await customContactRepository.findOne({
        id: agreement_id,
        installer_id: user_id,
      });
      if (!agreement) {
        return ReE(res, NO_CONTENT, "Contract not found or unauthorized");
      }

      const document: any = await customContactDocumentRepository.findOne({
        id: docId,
        installer_id: user_id,
      });
      if (!document) return ReE(res, NO_CONTENT, "Document not found");

      const filePath = getRelativeFilePath(document.url);
      if (filePath) await deleteFileFromStorage(filePath);
      await customContactDocumentRepository.deleteById(docId);

      if (agreement?.sender) {
        await createContactNotification({
          userId: agreement.sender,
          agreement,
          user: req.user,
          sender: req.user,
          type: "CREATED",
          message: `Document deleted for Contract #${agreement.id}.`,
        });
      }

      return ReS(res, SUCCESS_CODE, "Document deleted successfully");
    } catch (err) {
      console.error("deleteContactDocument error:", err);
      return ReE(res, SERVER_ERROR_CODE, "Failed to delete document");
    }
  }

  async deleteContact(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!id) return ReE(res, BAD_REQUEST_CODE, "Contract ID is required");

      const agreement: any = await customContactRepository.findById(id, { lean: true });
      if (!agreement) return ReE(res, NO_CONTENT, "Contract not found");

      const documents: any[] = await customContactDocumentRepository.find(
        { installer_id: agreement.installer_id },
        { select: "id url", lean: true },
      );

      for (const document of documents) {
        const filePath = getRelativeFilePath(document.url);
        if (filePath) await deleteFileFromStorage(filePath);
        await customContactDocumentRepository.deleteById(document.id);
      }

      const signaturePath = getRelativeFilePath(agreement.signature_url);
      if (signaturePath) await deleteFileFromStorage(signaturePath);

      const pdfPath = getRelativeFilePath(agreement.pdf_url);
      if (pdfPath) await deleteFileFromStorage(pdfPath);

      await customContactRepository.deleteById(id);

      await createContactNotification({
        userId: req.user.id,
        agreement,
        user: req.user,
        sender: req.user,
        type: "CREATED",
        message: `Contract #${agreement.id} deleted.`,
      });

      return ReS(res, SUCCESS_CODE, "Contract deleted successfully");
    } catch (err) {
      console.error("deleteContact error:", err);
      return ReE(res, SERVER_ERROR_CODE, "Failed to delete contract");
    }
  }
}

export default new CustomContactController();
