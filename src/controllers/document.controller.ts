import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Response } from "express";
import { documentRepository, userRepository } from "@repositories";
import { ReS, ReE } from "@services/generalHelper.service";
import { SUCCESS_CODE, SERVER_ERROR_CODE } from "@constants/serverCode";
import { DocumentsAuthenticatedRequest } from "@constants/common.interface";
import { UploadedFile } from "express-fileupload";
import { Roles } from "src/data/dataInserter";

class DocumentController {
  private readonly baseUploadDir: string;
  private readonly prefixUploadUrl: string = "/uploads/documents";
  constructor() {
    this.baseUploadDir = path.join(process.cwd(), "uploads", "documents");

    if (!fs.existsSync(this.baseUploadDir)) {
      fs.mkdirSync(this.baseUploadDir, { recursive: true });
    }
  }

  async upload(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const { document_name:title, description, user_id} = req.body;
      const userId = req.user?.id;
      const file = req?.files?.file as UploadedFile;

      if (!user_id) return ReE(res, SERVER_ERROR_CODE, "user id required");
      if (!file) return ReE(res, SERVER_ERROR_CODE, "No file uploaded");

      const userFolder = path.join(this.baseUploadDir, `user_${user_id}`);
      if (!fs.existsSync(userFolder)) {
        fs.mkdirSync(userFolder, { recursive: true });
      }

      const MAX_SIZE = 10 * 1024 * 1024;
      if (file.size > MAX_SIZE)
        return ReE(res, SERVER_ERROR_CODE, "File exceeds 10MB limit");

      const allowedTypes = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "text/plain",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      if (!allowedTypes.includes(file.mimetype)) {
        return ReE(res, SERVER_ERROR_CODE, "Unsupported file type");
      }

      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storedName = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}_${safeFileName}`;
      const filePath = path.join(userFolder, storedName);

      const verificationHash = crypto.randomBytes(3).toString("hex").toUpperCase();

      await file.mv(filePath);

      const document:any = await documentRepository.create({
        user_id,
        uploader_id: userId,
        title,
        description: description ? JSON.parse(description) : [],
        original_name: file.name,
        stored_name: storedName,
        mime_type: file.mimetype,
        size_bytes: file.size,
        file_path: this.prefixUploadUrl + `/user_${user_id}/` + storedName,
        verification_hash: verificationHash,
      });

      return ReS(res, SUCCESS_CODE, "Document uploaded successfully", {
        id: document.id,
        verification_code: verificationHash,
      });
    } catch (error: any) {
      console.error("Upload Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async getAllUniqueUserInfos(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const { user } = req;
      const {
        limit = 10,
        page = 1,
        cust_name = null,
        cust_email = null,
        start_date,
        end_date,
        order_by = "user_id",
        order_direction = "DESC",
      } = req.body;

      if (user?.role !== Roles.SUPER_ADMIN)
        return ReE(res, SERVER_ERROR_CODE, "Unauthorized access");

      const parsedLimit = parseInt(limit as string, 10);
      const parsedPage = parseInt(page as string, 10);
      const skip = (parsedPage - 1) * parsedLimit;

      const docMatch: Record<string, unknown> = {};
      if (start_date && end_date) {
        docMatch.created_at = {
          $gte: new Date(start_date),
          $lte: new Date(end_date),
        };
      }

      const userMatch: Record<string, unknown> = { deleted_at: null };
      if (cust_name) userMatch.name = { $regex: cust_name, $options: "i" };
      if (cust_email) userMatch.email = { $regex: cust_email, $options: "i" };

      const sortDir = order_direction === "ASC" ? 1 : -1;
      const sortField = order_by === "user_id" ? "_id" : order_by;

      const [rows, countResult] = await Promise.all([
        documentRepository.aggregateRaw([
          ...(Object.keys(docMatch).length ? [{ $match: docMatch }] : []),
          { $group: { _id: "$user_id", total_documents: { $sum: 1 } } },
          {
            $lookup: {
              from: "users",
              localField: "_id",
              foreignField: "id",
              as: "user",
            },
          },
          { $unwind: "$user" },
          { $match: userMatch },
          { $sort: { [sortField]: sortDir } },
          { $skip: skip },
          { $limit: parsedLimit },
          {
            $project: {
              _id: 0,
              user_id: "$_id",
              name: "$user.name",
              email: "$user.email",
              mobile_no: "$user.mobile_no",
              address: "$user.address",
              total_documents: 1,
            },
          },
        ]),
        documentRepository.aggregateRaw([
          ...(Object.keys(docMatch).length ? [{ $match: docMatch }] : []),
          { $group: { _id: "$user_id", total_documents: { $sum: 1 } } },
          {
            $lookup: {
              from: "users",
              localField: "_id",
              foreignField: "id",
              as: "user",
            },
          },
          { $unwind: "$user" },
          { $match: userMatch },
          { $count: "total" },
        ]),
      ]);

      const totalUsers = countResult[0]?.total ?? 0;

      return ReS(
        res,
        SUCCESS_CODE,
        "Unique user infos fetched successfully",
        {
          currentPage: parsedPage,
          totalPages: Math.ceil(totalUsers / parsedLimit),
          limit: parsedLimit,
          totalUsers,
          data: rows,
        }
      );
    } catch (error: any) {
      console.error("GetAllUniqueUserInfos Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async getDocument(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const user = req.user;
      if (!id) return ReE(res, SERVER_ERROR_CODE, "Document id is required");

      const doc: any = await documentRepository.findOne({ id });
      if (!doc) return ReE(res, SERVER_ERROR_CODE, "Document not found");

      // Owner, super admin, or any authenticated CRM user (same openness as list-by-user_id for profiles).
      if (!user?.id) {
        return ReE(res, SERVER_ERROR_CODE, "Unauthorized access");
      }

      await documentRepository.updateOne(
        { id: doc.id },
        { $set: { downloads: (doc.downloads || 0) + 1 } },
      );

      const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
      const fileUrl = `${BASE_URL}${doc.file_path}`;

      return ReS(res, SUCCESS_CODE, "Document URL generated successfully", {
        id: doc.id,
        title: doc.title,
        url: fileUrl,
      });
    } catch (error: any) {
      console.error("Get Document Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async deleteDocument(req: DocumentsAuthenticatedRequest, res: Response) {
    try {
      const id = req.params.id;
      const userRole = req.user?.role;

      const doc: any = await documentRepository.findOne({ id });
      if (!doc) return ReE(res, SERVER_ERROR_CODE, "Document not found");

      if (userRole !== Roles.SUPER_ADMIN)
        return ReE(res, SERVER_ERROR_CODE, "Unauthorized to delete this document");
      const path_ = path.join(process.cwd(), doc.file_path);
      if (fs.existsSync(path_)) {
        fs.unlinkSync(path_);
      }

      await documentRepository.deleteOne({ id });
      return ReS(res, SUCCESS_CODE, "Document deleted successfully", { id });
    } catch (error: any) {
      console.error("Delete Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

async getAllDocuments(req: DocumentsAuthenticatedRequest, res: Response) {
  try {
    const userId = req.body?.user_id;

    if (!userId) {
      return ReE(res, SERVER_ERROR_CODE, "Unauthorized access — user ID missing.");
    }

    const user = await userRepository.findById(Number(userId), {
      select: "id name email mobile_no address",
      lean: true,
    });

    if (!user) {
      return ReE(res, SERVER_ERROR_CODE, "User not found in the system.");
    }

    const documents = await documentRepository.find(
      { user_id: Number(userId) },
      {
        sort: { created_at: -1 },
        select: "id title original_name mime_type size_bytes created_at",
        lean: true,
      },
    );

    const formattedDocuments = documents.map((doc: any) => ({
      id: doc.id,
      title: doc.title,
      original_name: doc.original_name,
      mime_type: doc.mime_type,
      size_bytes: doc.size_bytes,
      created_at: doc.created_at,
    }));

    const responsePayload = {
      user,
      total_documents: formattedDocuments.length,
      documents: formattedDocuments,
    };

    console.log(
      `✅ [getAllDocuments] User ${userId} — ${formattedDocuments.length} documents fetched`
    );

    return ReS(
      res,
      SUCCESS_CODE,
      "User documents fetched successfully.",
      responsePayload
    );
  } catch (error: any) {
    console.error("❌ [getAllDocuments] Error:", error);
    return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
  }
}

}

export default new DocumentController();
