import { BAD_REQUEST_CODE, FORBIDDEN_CODE, NO_CONTENT, SERVER_ERROR_CODE, SUCCESS_CODE } from "@constants/serverCode";
import { installerAgreementRepository, installerDocumentRepository, roleRepository, userRepository } from "@repositories";
import { Request, Response } from "express";
import { bypassTokenCreation, generate_Hash_Password, ReE, ReS, verifyBypassToken } from "@services/generalHelper.service";
import { AuthenticatedRequest, DocumentsAuthenticatedRequest } from "@constants/common.interface";
import { UploadCategory } from "@constants/common.enum";
import { deleteFileFromStorage, getRelativeFilePath, uploadFiles } from "@utils/fileUpload.helper";
import { sendEmail } from "@utils/email";
import { eventTemplate } from "@template/eventTemplate";
import { EVENT_TASK_TYPE } from "@constants/socket.constants";
import notificationController from "./notification.controller";
import { getCompanyConfig } from "@services/crmSettings.service";
import { Roles } from "src/data/dataInserter";

type InstallerAgreementEmailType = "CREATED" | "FOLLOW_UP" | "SIGNED";

const agreementPopulate = [
  { path: "installer", select: "id name email mobile_no address" },
  { path: "sended_by", select: "id name email mobile_no address" },
];

const buildAgreementPdfEmailTemplate = ({
  recipientName,
  agreement,
  senderName,
}: {
  recipientName: string;
  agreement: any;
  senderName?: string;
}) => {
  const agreementId = agreement?.id || "";
  const jobType = agreement?.job_type || "Installer Agreement";
  const address = agreement?.address || "-";
  const phone = agreement?.phone || "-";
  const email = agreement?.email || "-";

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <div style="max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="margin: 0 0 12px; color: #111827;">Installer Agreement PDF</h2>
        <p style="margin: 0 0 12px;">Hello ${recipientName},</p>
        <p style="margin: 0 0 12px;">
          Please find the Installer Agreement PDF attached. If you have any questions, reply to this email.
        </p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px;">
          <p style="margin: 0 0 6px;"><strong>Agreement #:</strong> ${agreementId}</p>
          <p style="margin: 0 0 6px;"><strong>Job Type:</strong> ${jobType}</p>
          <p style="margin: 0 0 6px;"><strong>Address:</strong> ${address}</p>
          <p style="margin: 0 0 6px;"><strong>Phone:</strong> ${phone}</p>
          <p style="margin: 0;"><strong>Email:</strong> ${email}</p>
        </div>
        <p style="margin: 16px 0 0;">
          Regards,<br />
          ${senderName || "SOMS Team"}
        </p>
      </div>
    </div>
  `;
};

const buildAgreementLink = (agreementId: number, bypassToken?: string | null) => {
  const tokenPart = bypassToken ? `/?bypass_token=${bypassToken}` : "";
  return `${process.env.FRONT_URL}/#/installer-agreement/${agreementId}${tokenPart}`;
};

const resolveAgreementRecipient = (agreement: any, installer: any) => {
  return {
    name: agreement?.name || installer?.name || agreement?.email || installer?.email || "Installer",
    email: agreement?.email || installer?.email,
  };
};

const ensureAgreementBypassToken = async (agreement: any) => {
  if (agreement?.bypass_token) return agreement.bypass_token;
  const bypass_token = bypassTokenCreation({ id: agreement.installer_id, agreement_id: agreement.id });
  await installerAgreementRepository.updateById(agreement.id, { $set: { bypass_token } });
  return bypass_token;
};

const sendInstallerAgreementEmail = async ({
  agreement,
  installer,
  type,
  cc = [],
  bcc = [],
}: {
  agreement: any;
  installer: any;
  type: InstallerAgreementEmailType;
  cc?: string[];
  bcc?: string[];
}) => {
  const { name, email } = resolveAgreementRecipient(agreement, installer);
  if (!email) return;

  const bypassToken = await ensureAgreementBypassToken(agreement);
  const link = buildAgreementLink(agreement.id, bypassToken);
  const title = `Installer Agreement #${agreement.id}`;
  const status = agreement.status || "draft";
  const dueDate = agreement.created_at
    ? new Date(agreement.created_at).toISOString().split("T")[0]
    : "";

  const event =
    type === "FOLLOW_UP" ? EVENT_TASK_TYPE.UPDATED : EVENT_TASK_TYPE.CREATED;
  const subject =
    type === "FOLLOW_UP"
      ? `🔔 Follow Up: ${title}`
      : "Your Installer Agreement is Ready ✔";

  const cfg = await getCompanyConfig();
  const htmlTemplate = eventTemplate(
    name,
    agreement.id,
    "INSTALLER AGREEMENT",
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

const createAgreementNotification = async ({
  userId,
  agreement,
  installer,
  sender,
  type,
  message,
}: {
  userId: number;
  agreement: any;
  installer: any;
  sender: any;
  type: InstallerAgreementEmailType;
  message?: string;
}) => {
  const bypassToken = await ensureAgreementBypassToken(agreement);
  const route = buildAgreementLink(agreement.id, bypassToken);
  const action = type === "FOLLOW_UP" ? "Follow-up sent for" : "New";
  await notificationController.createNotification({
    userId,
    message: message || `${action} Installer Agreement #${agreement.id}.`,
    route,
    meta: {
      installerId: agreement.installer_id,
      installerName: installer?.name || agreement?.name,
      type: "INSTALLER_AGREEMENT",
      senderName: sender?.name,
      role: sender?.role,
    },
  });
};


class InstallerAgreementController {
  async saveInstallerAgreement(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        name,
        license,
        phone,
        email,
        address,
        job_type,
        html_content,
        terms_conditions = []
      } = req.body;
      let { installer_id = null } = req.body;
      if (!html_content) {
        return ReE(res, BAD_REQUEST_CODE, "Required fields missing");
      }
      let installer;
      if (installer_id)
        installer = await userRepository.findById(Number(installer_id), { lean: true });
      else if (!installer_id) {
        const existingUser = await userRepository.findOne({ email });
        installer_id = existingUser?.id;
        if (!existingUser) {
          const installerRole: any = await roleRepository.findOne(
            { name: Roles.INSTALLER },
            { select: "id", lean: true },
          );
          const newUser: any = await userRepository.create({
            username: email,
            name: name,
            email,
            address,
            mobile_no: phone,
            password: await generate_Hash_Password(email),
            role_id: installerRole?.id,
          });
          installer_id = newUser.id
        }
      }
      const existing = await installerAgreementRepository.findOne({
        installer_id,
      });

      const isNewAgreement = !existing;
      let agreement:any;
      if (existing) {
        agreement = await installerAgreementRepository.updateById(Number(existing.id), {
          $set: {
            name,
            license,
            phone,
            email,
            address,
            job_type,
            html_content,
            sender: req.user.id,
            terms_conditions,
          },
        });
      } else {
        agreement = await installerAgreementRepository.create({
          installer_id,
          name,
          license,
          phone,
          email,
          address,
          job_type,
          html_content,
          sender: req.user.id,
          terms_conditions
        });
        const bypass_token = bypassTokenCreation({ id: installer_id, agreement_id: agreement.id });
        agreement = await installerAgreementRepository.updateById(agreement.id, {
          $set: { bypass_token },
        });
      }

      const response = ReS(res, SUCCESS_CODE, "Agreement saved", agreement);
      if (isNewAgreement) {
        (async () => {
          try {
            await createAgreementNotification({
              userId: req.user.id,
              agreement,
              installer,
              sender: req.user,
              type: "CREATED",
            });
            await sendInstallerAgreementEmail({
              agreement,
              installer,
              type: "CREATED",
            });
          } catch (err) {
            console.error("Installer agreement email/notification failed:", err);
          }
        })();
      }
      return response;
    } catch (err) {
      console.error(err);
      return ReE(res, SERVER_ERROR_CODE, "Failed to save agreement");
    }
  }

  async updateInstallerAgreement(req: AuthenticatedRequest, res: Response) {
    const token:any = req.params.token;
    const { id: installer_id, agreement_id } = verifyBypassToken(token);
    if (!installer_id || !agreement_id) return ReE(res, FORBIDDEN_CODE, "Unauthorized access");
    try {
      const {
        name,
        license,
        phone,
        address,
        html_content,
        terms_conditions
      } = req.body;

      if (!name || !html_content || !license || !phone || !address)
        return ReE(res, BAD_REQUEST_CODE, "Required fields [name, license, phone, address, html_content] missing");

      const existing:any = await installerAgreementRepository.findOne({
        installer_id,
        id: agreement_id,
      });
      if (!existing) return ReE(res, NO_CONTENT, "Agreement not found");

      const data = await installerAgreementRepository.updateById(agreement_id, {
        $set: {
          name,
          license,
          phone,
          address,
          html_content,
          sender: req.user.id,
          terms_conditions
        },
      });
      return ReS(res, SUCCESS_CODE, "Agreement saved", data);

    } catch (err) {
      console.error(err);
      return ReE(res, SERVER_ERROR_CODE, "Failed to save agreement");
    }
  }
  async signInstallerAgreement(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const { id: installer_id, agreement_id } = req.user;
      const signature = req.files?.signature;

      if (!agreement_id || !signature) {
        return ReE(res, BAD_REQUEST_CODE, "Signature required");
      }

      const agreement: any = await installerAgreementRepository.findOne(
        { id: agreement_id, installer_id },
        { populate: { path: "sended_by", select: "id name email mobile_no address" } },
      );
      if (!agreement) {
        return ReE(res, NO_CONTENT, "Agreement not found");
      }

      if (agreement.status === "signed") {
        return ReE(res, BAD_REQUEST_CODE, "Agreement already signed");
      }

      const uploaded: any = await uploadFiles({
        category: UploadCategory.INSTALLER_SIGNATURE,
        files: signature,
        entityId: agreement_id,
        allowedTypes: ["image/png", "image/jpeg"],
        maxSizeMB: 5,
      });

      const updatedAgreement = await installerAgreementRepository.updateById(agreement_id, {
        $set: {
          signature_url: uploaded.url,
          accepted: true,
          accepted_at: new Date(),
          accepted_ip: req.ip,
          status: "signed",
        },
      });

      if (agreement?.sended_by) {
        await createAgreementNotification({
          userId: agreement.sended_by.id,
          agreement: updatedAgreement,
          installer: req.user,
          sender: agreement?.sended_by?.name,
          type: "SIGNED",
          message: `Installer Agreement #${agreement.id} has been signed.`,
        });
      }

      return ReS(res, SUCCESS_CODE, "Agreement signed", updatedAgreement);
    } catch (err) {
      console.error(err);
      return ReE(res, SERVER_ERROR_CODE, "Failed to sign agreement");
    }
  }

  async uploadInstallerDocument(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const { document_type } = req.body;
      const { id: installer_id, agreement_id } = req.user;

      const file = req.files?.document;

      if (!installer_id || !agreement_id) {
        return ReE(res, FORBIDDEN_CODE, "Unauthorized access");
      }

      if (!document_type || !file) {
        return ReE(res, BAD_REQUEST_CODE, "Missing fields");
      }

      const agreement: any = await installerAgreementRepository.findOne({
        id: agreement_id,
        installer_id,
      });

      if (!agreement) {
        return ReE(
          res,
          NO_CONTENT,
          "Agreement not found or you don't have access"
        );
      }

      const uploaded: any = await uploadFiles({
        category: UploadCategory.INSTALLER_DOCUMENT,
        files: file,
        entityId: installer_id,
        maxSizeMB: 20,
      });

      const doc = await installerDocumentRepository.create({
        installer_id,
        agreement_id,
        document_type,
        url: uploaded.url,
      });

      if (agreement?.sender) {
        await createAgreementNotification({
          userId: agreement.sender,
          agreement,
          installer: req.user,
          sender: req.user,
          type: "CREATED",
          message: `Document uploaded for Installer Agreement #${agreement.id}.`,
        });
      }

      return ReS(res, SUCCESS_CODE, "Document uploaded successfully", doc);
    } catch (err) {
      console.error("uploadInstallerDocument error:", err);
      return ReE(res, SERVER_ERROR_CODE, "Failed to upload document");
    }
  }

  async getInstallerAgreement(req: AuthenticatedRequest, res: Response) {
    try {
      const { id, agreement_id } = req.user;
      if (agreement_id && !id) return ReE(res, FORBIDDEN_CODE, "Unauthorized access");
      const agreement: any = await installerAgreementRepository.findOne(
        { id: agreement_id, installer_id: id },
        { populate: agreementPopulate, sort: { created_at: -1 }, lean: true },
      );

      if (!agreement) {
        return ReE(res, NO_CONTENT, "No agreement found");
      }

      const documents = await installerDocumentRepository.find(
        { installer_id: agreement.installer_id },
        { select: "document_type url id", lean: true },
      );

      return ReS(res, SUCCESS_CODE, "Agreement fetched", {
        ...agreement,
        documents,
      });
    } catch (err) {
      console.error(err);
      return ReE(res, SERVER_ERROR_CODE, "Failed to fetch agreement");
    }
  }
  async getInstallerAgreementDocuments(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);

      const agreement: any = await installerAgreementRepository.findById(id, {
        select: "id installer_id",
        lean: true,
      });

      if (!agreement) {
        return ReE(res, NO_CONTENT, "Agreement not found");
      }

      const documents = await installerDocumentRepository.find(
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
      console.error("getInstallerAgreementDocuments error:", err);
      return ReE(res, SERVER_ERROR_CODE, "Failed to fetch documents");
    }
  }

  async getAllInstallerAgreements(req: Request, res: Response) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        installer_id,
        job_type,
        from_date,
        to_date,
        sort_by = "created_at",
        sort_order = "DESC",
      } = req.body;

      const safeLimit = Math.min(Number(limit), 50);
      const safePage = Math.max(Number(page), 1);
      const skip = (safePage - 1) * safeLimit;

      const match: Record<string, unknown> = { deleted_at: null };
      if (job_type) match.job_type = job_type;
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
      if (installer_id) installerMatch["installer.id"] = installer_id;

      const sortDir = sort_order.toUpperCase() === "ASC" ? 1 : -1;

      const [rows, countResult] = await Promise.all([
        installerAgreementRepository.aggregateRaw([
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
              from: "installer_documents",
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
        installerAgreementRepository.aggregateRaw([
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
        return ReS(res, SUCCESS_CODE, "No agreements found", {
          meta: {
            totalItems: count,
            totalPages: Math.ceil(count / safeLimit),
            currentPage: safePage,
            limit: safeLimit,
          },
          data: []
        });
      }

      return ReS(res, SUCCESS_CODE, "Agreements fetched successfully", {
        meta: {
          totalItems: count,
          totalPages: Math.ceil(count / safeLimit),
          currentPage: safePage,
          limit: safeLimit,
        },
        data: rows,
      });
    } catch (err) {
      console.error("getAllInstallerAgreements error:", err);
      return ReE(res, SERVER_ERROR_CODE, "Failed to fetch agreements");
    }
  }

  async sendInstallerAgreementFollowUp(
    req: AuthenticatedRequest,
    res: Response
  ) {
    try {
      const { agreementId, cc = [], bcc = [] } = req.body;

      if (!agreementId) {
        return ReE(res, BAD_REQUEST_CODE, "agreementId is required");
      }

      const agreement: any = await installerAgreementRepository.findOne(
        { id: agreementId },
        { populate: { path: "installer", select: "id name email" } },
      );

      if (!agreement) {
        return ReE(res, NO_CONTENT, "Agreement not found");
      }

      ReS(res, SUCCESS_CODE, "Follow-up email sent successfully.");

      await sendInstallerAgreementEmail({
        agreement,
        installer: agreement.installer,
        type: "FOLLOW_UP",
        cc,
        bcc,
      });

      await createAgreementNotification({
        userId: req.user.id,
        agreement,
        installer: agreement.installer,
        sender: req.user,
        type: "FOLLOW_UP",
      });

      return;
    } catch (err: any) {
      console.error("sendInstallerAgreementFollowUp error:", err);
      return ReE(
        res,
        SERVER_ERROR_CODE,
        err.message || "Failed to send follow-up"
      );
    }
  }

  async sendInstallerAgreementPdf(req: AuthenticatedRequest, res: Response) {
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

      const agreement: any = await installerAgreementRepository.findOne(
        { id: agreementId },
        { populate: agreementPopulate },
      );

      if (!agreement) {
        return ReE(res, NO_CONTENT, "Agreement not found");
      }

      let pdfBuffer: Buffer;
      let attachmentName = fileName || `installer-agreement-${agreement.id}.pdf`;

      if (pdfFile) {
        const fileItem = Array.isArray(pdfFile) ? pdfFile[0] : pdfFile;
        pdfBuffer = fileItem.data;
        attachmentName = attachmentName || fileItem.name;
      } else {
        const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
        pdfBuffer = Buffer.from(base64Data, "base64");
      }

      const installerEmail = agreement?.email || agreement?.installer?.email;
      const installerName =
        agreement?.name || agreement?.installer?.name || "Installer";
      const senderEmail = agreement?.sended_by?.email;

      if (!installerEmail) {
        return ReE(res, NO_CONTENT, "Installer email not found");
      }

      const attachments = [
        {
          filename: attachmentName,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ];

      const htmlTemplate = buildAgreementPdfEmailTemplate({
        recipientName: installerName,
        agreement,
        senderName: agreement?.sended_by?.name || req.user?.name,
      });
      const ccList = senderEmail ? [senderEmail] : [];

      await sendEmail(
        installerEmail,
        `Installer Agreement PDF #${agreement.id}`,
        htmlTemplate,
        ccList,
        [],
        attachments
      );

      return ReS(res, SUCCESS_CODE, "PDF sent successfully");
    } catch (err: any) {
      console.error("sendInstallerAgreementPdf error:", err);
      return ReE(res, SERVER_ERROR_CODE, err.message || "Failed to send PDF");
    }
  }

  async deleteInstallerDocument(req: AuthenticatedRequest, res: Response) {
    try {
      const docId = Number(req.params.id);
      const { id: installer_id, agreement_id } = req.user;
      if (agreement_id && !installer_id) return ReE(res, FORBIDDEN_CODE, "Unauthorized access");
      if (!agreement_id || !docId) {
        return ReE(
          res,
          BAD_REQUEST_CODE,
          "Agreement ID and Document ID are required"
        );
      }

      const agreement: any = await installerAgreementRepository.findOne({
        id: agreement_id,
        installer_id,
      });

      if (!agreement) {
        return ReE(
          res,
          NO_CONTENT,
          "Agreement not found or unauthorized access"
        );
      }

      const document: any = await installerDocumentRepository.findOne({
        id: docId,
        installer_id,
      });

      if (!document) {
        return ReE(
          res,
          NO_CONTENT,
          "Document not found for this agreement"
        );
      }

      const filePath = getRelativeFilePath(document.url);

      if (filePath) {
        await deleteFileFromStorage(filePath);
      }

      await installerDocumentRepository.deleteById(docId);

      if (agreement?.sender) {
        await createAgreementNotification({
          userId: agreement.sender,
          agreement,
          installer: req.user,
          sender: req.user,
          type: "CREATED",
          message: `Document deleted for Installer Agreement #${agreement.id}.`,
        });
      }

      return ReS(res, SUCCESS_CODE, "Document deleted successfully");
    } catch (err) {
      console.error("deleteInstallerDocument error:", err);
      return ReE(res, SERVER_ERROR_CODE, "Failed to delete document");
    }
  }

  async deleteInstallerAgreement(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!id) {
        return ReE(res, BAD_REQUEST_CODE, "Agreement ID is required");
      }

      const agreement: any = await installerAgreementRepository.findById(id, { lean: true });

      if (!agreement) {
        return ReE(res, NO_CONTENT, "Agreement not found");
      }

      const documents: any[] = await installerDocumentRepository.find(
        { installer_id: agreement.installer_id },
        { select: "id url", lean: true },
      );

      for (const document of documents) {
        const filePath = getRelativeFilePath(document.url);
        if (filePath) {
          await deleteFileFromStorage(filePath);
        }
        await installerDocumentRepository.deleteById(document.id);
      }

      const signaturePath = getRelativeFilePath(agreement.signature_url);
      if (signaturePath) {
        await deleteFileFromStorage(signaturePath);
      }

      const pdfPath = getRelativeFilePath(agreement.pdf_url);
      if (pdfPath) {
        await deleteFileFromStorage(pdfPath);
      }

      await installerAgreementRepository.deleteById(id);

      await createAgreementNotification({
        userId: req.user.id,
        agreement,
        installer: req.user,
        sender: req.user,
        type: "CREATED",
        message: `Installer Agreement #${agreement.id} deleted.`,
      });

      return ReS(res, SUCCESS_CODE, "Agreement deleted successfully");
    } catch (err) {
      console.error("deleteInstallerAgreement error:", err);
      return ReE(res, SERVER_ERROR_CODE, "Failed to delete agreement");
    }
  }

}

export default new InstallerAgreementController();
