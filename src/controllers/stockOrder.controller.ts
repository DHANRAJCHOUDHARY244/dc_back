import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Response } from "express";
import { UploadedFile } from "express-fileupload";
import {
  companyRepository,
  quoteRepository,
  quoteWorkflowRepository,
  stockOrderRepository,
  userRepository,
} from "@repositories";
import { ReS, ReE, generateUUID, bypassTokenCreation } from "@services/generalHelper.service";
import {
  SUCCESS_CODE,
  SERVER_ERROR_CODE,
  BAD_REQUEST_CODE,
  FORBIDDEN_CODE,
} from "@constants/serverCode";
import { AuthenticatedRequest } from "@constants/common.interface";
import StockOrderService from '@services/stockOrder.service';
import { validate as isEmail } from "email-validator";

const stockOrderListPopulate = [
  { path: "sender", select: "id name email" },
  { path: "company", select: "id company_name" },
  { path: "quote", select: "id name total" },
];

const stockOrderDetailPopulate = [
  { path: "sender", select: "id name email" },
  {
    path: "quote",
    populate: { path: "customer", select: "id name email address mobile_no" },
  },
  { path: "company" },
];

class StockOrderController {
  private readonly baseUploadDir: string;
  private readonly prefixUploadUrl: string = "/uploads/stocks";

  constructor() {
    this.baseUploadDir = path.join(process.cwd(), "uploads", "stocks");
    if (!fs.existsSync(this.baseUploadDir)) fs.mkdirSync(this.baseUploadDir, { recursive: true });
  }

  private makeQuoteFolder(quoteId: number) {
    const folder = path.join(this.baseUploadDir, String(quoteId));
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    return folder;
  }

  private safeFileName(origName: string) {
    return origName.replace(/[^a-zA-Z0-9._-]/g, "_");
  }

  private storeFile(file: UploadedFile, destFolder: string) {
    const safeName = this.safeFileName(file.name);
    const storedName = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}_${safeName}`;
    const filePath = path.join(destFolder, storedName);
    file.mv(filePath);
    return storedName;
  }

  async createStockOrder(req: AuthenticatedRequest, res: Response) {
    try {
      const { quote_id, company_id, stock_product_metadata = [], emails_sent, address = '' } = req.body;
      const sender = req.user;
      if (!quote_id || !company_id || !emails_sent || !address?.length) {
        return ReE(res, BAD_REQUEST_CODE, "quote_id, email_sent, address and company_id are required or invalid address.");
      }
      if (emails_sent) {
        const { to, cc = [], bcc = [] } = emails_sent;
        if (!to) return ReE(res, BAD_REQUEST_CODE, "emails_sent.to is required");
        if (!isEmail(to)) return ReE(res, BAD_REQUEST_CODE, `emails_sent.to: ${to} is invalid`);
        for (const email of [...cc, ...bcc]) {
          if (!isEmail(email)) return ReE(res, BAD_REQUEST_CODE, `Invalid email: ${email}`);
        }
      }
      const quote = await quoteRepository.findById(Number(quote_id));
      const company = await companyRepository.findById(Number(company_id));
      if (!quote) return ReE(res, FORBIDDEN_CODE, "Quote not found.");
      if (!company) return ReE(res, FORBIDDEN_CODE, "Company not found.");
      const existing = await stockOrderRepository.findOne({ quote_id }, { lean: true });
      if (existing) return ReE(res, FORBIDDEN_CODE, "Stock already created");
      const payload: any = {
        quote_id,
        sender_id: sender.id,
        company_id,
        address,
        stock_product_metadata: typeof stock_product_metadata === "string" ? JSON.parse(stock_product_metadata) : stock_product_metadata,
        stock_order_date: new Date(),
        emails_sent
      };
      payload.bypass_token = {
        crm: bypassTokenCreation({ stock_order_quote_id: quote_id, role: "crm", company_id }),
        company: bypassTokenCreation({ stock_order_quote_id: quote_id, role: "company", company_id }),
        driver: bypassTokenCreation({ stock_order_quote_id: quote_id, role: "driver", company_id }),
      }
     const stock:any = await stockOrderRepository.create(payload);
      const quoteWorkFlowData:any = await quoteWorkflowRepository.findOne({ quote_id });
      if(quoteWorkFlowData){
        await quoteWorkflowRepository.updateById(quoteWorkFlowData.id, { $set: { stock_id: stock.id } });
      }
      const created = await stockOrderRepository.findOne(
        { quote_id },
        { populate: stockOrderDetailPopulate },
      );
      ReS(res, SUCCESS_CODE, "Stock order created successfully.", created);
      const stockData = await stockOrderRepository.findOne({ quote_id });
      return StockOrderService.sendCreatedNotification(stockData).catch((e) => console.error("StockOrderService error:", e.message));

    } catch (error: any) {
      console.error("Error in createStockOrder:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async confirmStock(req: AuthenticatedRequest, res: Response) {
    try {
      const { id, bypass_token }:any = req.params;
      const files = req.files as any;
      const { confirm_date, driver_name, driver_vehicle_name, driver_vehicle_no, driver_email, driver_mob, expected_delivery_date, expected_delivery_time, tracking_number } = req.body;

      if (!id) return ReE(res, BAD_REQUEST_CODE, "Stock order id is required.");

      const order: any = await stockOrderRepository.findById(Number(id), {
        populate: [{ path: "quote" }, { path: "sender" }],
        lean: true,
      });
      if (!order) return ReE(res, FORBIDDEN_CODE, "Stock order not found.");

      const quoteFolder = this.makeQuoteFolder(order.quote_id);
      const confirmFolder = path.join(quoteFolder, "confirm_docs");
      if (!fs.existsSync(confirmFolder)) fs.mkdirSync(confirmFolder, { recursive: true });

      const savedFiles: any[] = [];

      if (files && files.confirm_docs) {
        const fileList = Array.isArray(files.confirm_docs) ? files.confirm_docs : [files.confirm_docs];
        for (const f of fileList) {
          const allowedTypes = [
            "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp",
            "image/avif", "image/heic", "image/heif", "image/tiff",
            "image/x-dng", "image/x-adobe-dng", "image/x-canon-cr2", "image/x-nikon-nef",
            "image/x-sony-arw", "image/x-fuji-raf", "image/x-olympus-orf", "image/x-panasonic-rw2",
            "image/x-pentax-pef", "image/x-sigma-x3f", "image/x-sr2",
            "image/vnd.adobe.photoshop", "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/plain", "text/csv",
          ];

          if (!allowedTypes.includes(f.mimetype)) {
            return ReE(res, BAD_REQUEST_CODE, `Invalid file type: ${f.mimetype}. Allowed: Images, PDF, DOC/DOCX, XLS/XLSX, TXT, CSV`);
          }

          const storedName = this.storeFile(f as UploadedFile, confirmFolder);
          const fileUrl = `${this.prefixUploadUrl}/${order.quote_id}/confirm_docs/${storedName}`;
          savedFiles.push({
            originalName: f.name,
            url: fileUrl,
            uploadedAt: new Date(),
          });
        }
      }

      const existingConfirm = order.stock_confirm_documents || [];
      const newConfirm = Array.isArray(existingConfirm) ? [...existingConfirm, ...savedFiles] : savedFiles;

      const updateData: any = {
        stock_confirm_documents: newConfirm,
        stock_confirm_date: confirm_date ? new Date(confirm_date) : new Date(),
        stock_order_status: "CONFIRMED",
        updated_at: new Date(),
        driver_name,
        driver_vehicle_name,
        driver_vehicle_no,
        driver_email,
        driver_mob,
        expected_delivery_time: expected_delivery_time || "",
        tracking_number: tracking_number || "",
      };
      if (expected_delivery_date) {
        updateData.expected_delivery_date = new Date(expected_delivery_date);
      }

      await stockOrderRepository.updateMany({ id: Number(id) }, { $set: updateData });
      const updated = await stockOrderRepository.findById(Number(id), {
        populate: stockOrderDetailPopulate,
        lean: true,
      });

      StockOrderService.sendConfirmedNotification(updated).catch((e) => console.error("StockOrderService error:", e.message));
      StockOrderService.sendCustomerDeliveryScheduledEmail(updated).catch((e) =>
        console.error("Customer delivery email error:", e.message),
      );

      return ReS(res, SUCCESS_CODE, "Stock confirmed successfully. Customer delivery email queued.", updated);
    } catch (error: any) {
      console.error("Error in confirmStock:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async deliverStock(req: AuthenticatedRequest, res: Response) {
    try {
      const { id }:any = req.params;
      const files = req.files as any;
      const { delivered_date } = req.body;

      if (!id) return ReE(res, BAD_REQUEST_CODE, "Stock order id is required.");

      const order: any = await stockOrderRepository.findById(Number(id), {
        populate: [{ path: "quote" }, { path: "sender" }],
        lean: true,
      });
      if (!order) return ReE(res, FORBIDDEN_CODE, "Stock order not found.");

      const quoteFolder = this.makeQuoteFolder(order.quote_id);
      const deliveredFolder = path.join(quoteFolder, "delivered_docs");
      if (!fs.existsSync(deliveredFolder)) fs.mkdirSync(deliveredFolder, { recursive: true });

      const savedFiles: any[] = [];

      if (files && files.delivered_docs) {
        const fileList = Array.isArray(files.delivered_docs) ? files.delivered_docs : [files.delivered_docs];
        for (const f of fileList) {
           const allowedTypes = [
            "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp",
            "image/avif", "image/heic", "image/heif", "image/tiff",
            "image/x-dng", "image/x-adobe-dng", "image/x-canon-cr2", "image/x-nikon-nef",
            "image/x-sony-arw", "image/x-fuji-raf", "image/x-olympus-orf", "image/x-panasonic-rw2",
            "image/x-pentax-pef", "image/x-sigma-x3f", "image/x-sr2",
            "image/vnd.adobe.photoshop", "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/plain", "text/csv",
          ];

          if (!allowedTypes.includes(f.mimetype)) {
            return ReE(res, BAD_REQUEST_CODE, `Invalid file type: ${f.mimetype}. Allowed: Images, PDF, DOC/DOCX, XLS/XLSX, TXT, CSV`);
          }
          const storedName = this.storeFile(f as UploadedFile, deliveredFolder);
          const fileUrl = `${this.prefixUploadUrl}/${order.quote_id}/delivered_docs/${storedName}`;
          savedFiles.push({
            originalName: f.name,
            url: fileUrl,
            uploadedAt: new Date(),
          });
        }
      }

      const existingDelivered = order.stock_delivered_documents || [];
      const newDelivered = Array.isArray(existingDelivered) ? [...existingDelivered, ...savedFiles] : savedFiles;

      const updateData: any = {
        stock_delivered_documents: newDelivered,
        stock_delivered_date: delivered_date ? new Date(delivered_date) : new Date(),
        stock_order_status: "DELIVERED",
        updated_at: new Date(),
      };

      await stockOrderRepository.updateMany({ id: Number(id) }, { $set: updateData });
      const updated = await stockOrderRepository.findById(Number(id));

      StockOrderService.sendDeliveredNotification(updated).catch((e) => console.error("StockOrderService error:", e.message));

      return ReS(res, SUCCESS_CODE, "Stock marked as delivered successfully.", updated);
    } catch (error: any) {
      console.error("Error in deliverStock:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async updateStock(req: AuthenticatedRequest, res: Response) {
    try {
      const { id }: any = req.params;
      const updates = req.body;

      if (!id) return ReE(res, BAD_REQUEST_CODE, "Stock order id is required.");

      const order: any = await stockOrderRepository.findById(Number(id), {
        populate: stockOrderListPopulate,
        lean: true,
      });
      if (!order) return ReE(res, FORBIDDEN_CODE, "Stock order not found.");

      const allowed = [
        "stock_order_status", "company_id", "address", "stock_product_metadata",
        "stock_confirm_date", "stock_delivered_date", "stock_order_date",
        "driver_name", "driver_vehicle_name", "driver_vehicle_no",
        "driver_email", "driver_mob", "emails_sent",
      ];
      const payload: any = {};
      const changedFields: string[] = [];

      for (const k of allowed) {
        if (updates[k] !== undefined) {
          payload[k] = updates[k];
          if (JSON.stringify(order[k]) !== JSON.stringify(updates[k])) {
            changedFields.push(k);
          }
        }
      }
      payload.updated_at = new Date();

      const oldStatus = order.stock_order_status;
      const newStatus = updates.stock_order_status;
      const statusChanged = newStatus && newStatus !== oldStatus;

      if (statusChanged) {
        const progressEntry = {
          from: oldStatus,
          to: newStatus,
          changed_at: new Date().toISOString(),
          changed_by: req.user?.name || "System",
          changed_by_id: req.user?.id || null,
        };
        const existingProgress = Array.isArray(order.progress) ? order.progress : [];
        payload.progress = [...existingProgress, progressEntry];
      }

      await stockOrderRepository.updateMany({ id: Number(id) }, { $set: payload });

      const updated: any = await stockOrderRepository.findById(Number(id), {
        populate: stockOrderListPopulate,
        lean: true,
      });

      if (statusChanged) {
        StockOrderService.sendStatusUpdateNotification(updated, oldStatus, newStatus, req.user)
          .catch((e) => console.error("Status notification error:", e.message));
      }

      return ReS(res, SUCCESS_CODE, "Stock order updated successfully.", updated);
    } catch (error: any) {
      console.error("Error in updateStock:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async addFollowUp(req: AuthenticatedRequest, res: Response) {
    try {
      const { id }:any = req.params;
      const { note, follow_up_date, send_to, priority } = req.body;

      if (!id) return ReE(res, BAD_REQUEST_CODE, "Stock order id is required.");
      if (!note || !note.trim()) return ReE(res, BAD_REQUEST_CODE, "Note is required.");

      const order: any = await stockOrderRepository.findById(Number(id), {
        populate: stockOrderListPopulate,
        lean: true,
      });
      if (!order) return ReE(res, FORBIDDEN_CODE, "Stock order not found.");

      const targets = Array.isArray(send_to) ? send_to : [];

      let createdByName = "System";
      let createdById: any = null;
      let createdByRole: "crm" | "company" | "driver" | "system" = "system";

      if (req.user?.name) {
        createdByName = req.user.name;
        createdById = req.user.id;
        createdByRole = "crm";
      } else if ((req as any).bypass_token) {
        const bt = (req as any).bypass_token;
        const tokens = order.bypass_token || {};
        if (tokens.crm === bt) {
          createdByName = order.sender?.name || "CRM Admin";
          createdById = order.sender?.id || null;
          createdByRole = "crm";
        } else if (tokens.company === bt) {
          createdByName = order.company?.company_name || "Company";
          createdByRole = "company";
        } else if (tokens.driver === bt) {
          createdByName = order.driver_name || "Driver";
          createdByRole = "driver";
        }
      }

      const entry = {
        id: generateUUID(),
        note: note.trim(),
        follow_up_date: follow_up_date || null,
        priority: priority || "normal",
        send_to: targets,
        created_at: new Date().toISOString(),
        created_by: createdByName,
        created_by_id: createdById,
        created_by_role: createdByRole,
      };

      const existing = Array.isArray(order.progress) ? order.progress : [];
      const updated_progress = [...existing, entry];

      await stockOrderRepository.updateMany(
        { id: Number(id) },
        { $set: { progress: updated_progress, updated_at: new Date() } },
      );

      const recipientEmails: string[] = [];
      for (const t of targets) {
        if (t === "company" && order.emails_sent?.to) {
          recipientEmails.push(order.emails_sent.to);
        } else if (t === "driver" && order.driver_email) {
          recipientEmails.push(order.driver_email);
        } else if (t === "sender" && order.sender?.email) {
          recipientEmails.push(order.sender.email);
        } else if (typeof t === "string" && t.startsWith("custom:")) {
          const email = t.replace("custom:", "").trim();
          if (email && isEmail(email)) recipientEmails.push(email);
        }
      }

      StockOrderService.sendFollowUpNotification(order, entry, req.user, recipientEmails)
        .catch((e: any) => console.error("Follow-up notification error:", e.message));

      const updated = await stockOrderRepository.findById(Number(id), {
        populate: stockOrderListPopulate,
      });

      return ReS(res, SUCCESS_CODE, "Follow-up added successfully.", updated);
    } catch (error: any) {
      console.error("Error in addFollowUp:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async deleteFollowUp(req: AuthenticatedRequest, res: Response) {
    try {
      const { id, noteId }:any = req.params;

      if (!id || !noteId) return ReE(res, BAD_REQUEST_CODE, "Stock order id and note id are required.");

      const order: any = await stockOrderRepository.findById(Number(id), { lean: true });
      if (!order) return ReE(res, FORBIDDEN_CODE, "Stock order not found.");

      const existing = Array.isArray(order.progress) ? order.progress : [];
      const updated_progress = existing.filter((e: any) => e.id !== noteId);

      await stockOrderRepository.updateMany(
        { id: Number(id) },
        { $set: { progress: updated_progress, updated_at: new Date() } },
      );

      return ReS(res, SUCCESS_CODE, "Follow-up deleted successfully.");
    } catch (error: any) {
      console.error("Error in deleteFollowUp:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }
  async getStockOrders(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        limit = 10,
        page = 1,
        company_id = null,
        quote_id = null,
        status = null,
        sender_name = null,
        order_by = "created_at",
        order_direction = "DESC",
      } = req.body;

      const parsedLimit = parseInt(limit as any, 10);
      const parsedPage = parseInt(page as any, 10);

      const filter: Record<string, unknown> = {};
      if (company_id) filter.company_id = company_id;
      if (quote_id) filter.quote_id = quote_id;
      if (status) filter.stock_order_status = status;

      if (sender_name) {
        const senders = await userRepository.find(
          { name: { $regex: sender_name, $options: "i" } },
          { select: "id", lean: true },
        );
        if (!senders || senders.length === 0) return ReE(res, FORBIDDEN_CODE, "Sender not found.");
        filter.sender_id = { $in: senders.map((s: any) => s.id) };
      }

      const sortDir = order_direction === "ASC" ? 1 : -1;
      const { count, rows } = await stockOrderRepository.findPaginated(filter, {
        page: parsedPage,
        limit: parsedLimit,
        sort: { [order_by]: sortDir } as Record<string, 1 | -1>,
        populate: stockOrderListPopulate,
      });

      return ReS(res, SUCCESS_CODE, "Stock orders fetched successfully.", {
        currentPage: parsedPage,
        totalPages: Math.ceil(count / parsedLimit),
        limit: parsedLimit,
        totalOrders: count,
        data: rows,
      });
    } catch (error: any) {
      console.error("Error in getStockOrders:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async getStockOrderById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id, bypass_token } = req.params;
      if (!id || !bypass_token) return ReE(res, BAD_REQUEST_CODE, "Stock order id and bypass token are required.");
      if (!Number(id)) return ReE(res, BAD_REQUEST_CODE, "Invalid stock order id. Must Be number.");
      const order: any = await stockOrderRepository.findOne(
        { id: Number(id) },
        { populate: stockOrderDetailPopulate, lean: true },
      );
      if (!order) return ReE(res, FORBIDDEN_CODE, "Stock order not found.");
      const tokens = order?.bypass_token || {};
      if (bypass_token !== tokens.crm && bypass_token !== tokens.company && bypass_token !== tokens.driver)
        return ReE(res, FORBIDDEN_CODE, "Invalid bypass token.");

      return ReS(res, SUCCESS_CODE, "Stock order fetched successfully.", order);
    } catch (error: any) {
      console.error("Error in getStockOrderById:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async deleteConfirmDocument(req: AuthenticatedRequest, res: Response) {
    try {
      const { id, bypass_token }:any = req.params;
      const { fileUrl } = req.body;

      if (!id || !fileUrl)
        return ReE(res, BAD_REQUEST_CODE, "Stock order id and fileUrl are required.");

      const order: any = await stockOrderRepository.findById(Number(id), { lean: true });
      const tokens = order?.bypass_token || {};
      if (bypass_token !== tokens.crm && bypass_token !== tokens.company && bypass_token !== tokens.driver)
        return ReE(res, FORBIDDEN_CODE, "Invalid bypass token.");
      if (!order)
        return ReE(res, FORBIDDEN_CODE, "Stock order not found.");

      const docs = order.stock_confirm_documents || [];
      const targetDoc = docs.find((d: any) => d.url === fileUrl);
      if (!targetDoc)
        return ReE(res, FORBIDDEN_CODE, "Document not found.");

      const filePath = path.join(process.cwd(), targetDoc.url);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error("File delete error:", err);
        }
      }

      const updatedDocs = docs.filter((d: any) => d.url !== fileUrl);

      await stockOrderRepository.updateMany(
        { id: Number(id) },
        { $set: { stock_confirm_documents: updatedDocs, updated_at: new Date() } },
      );

      const updated = await stockOrderRepository.findById(Number(id));

      return ReS(res, SUCCESS_CODE, "Document deleted successfully.", updated);

    } catch (error: any) {
      console.error("Error in deleteConfirmDocument:", error);
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }
  
  async deleteStockOrder(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      if (!id) return ReE(res, BAD_REQUEST_CODE, "Stock order id is required.");

      const order: any = await stockOrderRepository.findById(Number(id), {
        populate: { path: "quote" },
        lean: true,
      });
      if (!order) return ReE(res, FORBIDDEN_CODE, "Stock order not found.");

      const quoteFolder = path.join(this.baseUploadDir, String(order.quote_id));
      if (fs.existsSync(quoteFolder)) {
        try {
          fs.rmSync(quoteFolder, { recursive: true, force: true });
        } catch (err) {
          console.error("Failed to remove stock order files:", err);
        }
      }

      await stockOrderRepository.deleteById(Number(id));

      return ReS(res, SUCCESS_CODE, "Stock order deleted successfully.");
    } catch (error: any) {
      console.error("Error in deleteStockOrder:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async updateStockStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { stock_order_status } = req.body;

      if (!id) return ReE(res, BAD_REQUEST_CODE, "Stock order id is required.");
      if (!stock_order_status) return ReE(res, BAD_REQUEST_CODE, "stock_order_status is required.");

      const validStatuses = ["PENDING", "ORDERED", "CONFIRMED", "DRIVER_ASSIGNED", "DELIVERED", "CANCELLED", "NOT_REQUIRED"];
      if (!validStatuses.includes(stock_order_status)) {
        return ReE(res, BAD_REQUEST_CODE, `Invalid status. Allowed: ${validStatuses.join(", ")}`);
      }

      const order = await stockOrderRepository.findById(Number(id));
      if (!order) return ReE(res, FORBIDDEN_CODE, "Stock order not found.");

      await stockOrderRepository.updateMany(
        { id: Number(id) },
        { $set: { stock_order_status, updated_at: new Date() } },
      );

      const updated = await stockOrderRepository.findById(Number(id), {
        populate: stockOrderListPopulate,
      });

      return ReS(res, SUCCESS_CODE, "Status updated successfully.", updated);
    } catch (error: any) {
      console.error("Error in updateStockStatus:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async deleteDeliveredDocument(req: AuthenticatedRequest, res: Response) {
     try {
      const { id, bypass_token }:any = req.params;
      const { fileUrl } = req.body;

      if (!id || !fileUrl)
        return ReE(res, BAD_REQUEST_CODE, "Stock order id and fileUrl are required.");

      const order: any = await stockOrderRepository.findById(Number(id), { lean: true });
      const tokens = order?.bypass_token || {};
      if (bypass_token !== tokens.crm && bypass_token !== tokens.company && bypass_token !== tokens.driver)
        return ReE(res, FORBIDDEN_CODE, "Invalid bypass token.");
      if (!order)
        return ReE(res, FORBIDDEN_CODE, "Stock order not found.");

      const docs = order.stock_delivered_documents || [];
      const targetDoc = docs.find((d: any) => d.url === fileUrl);
      if (!targetDoc)
        return ReE(res, FORBIDDEN_CODE, "Document not found.");

      const filePath = path.join(process.cwd(), targetDoc.url);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error("File delete error:", err);
        }
      }

      const updatedDocs = docs.filter((d: any) => d.url !== fileUrl);

      await stockOrderRepository.updateMany(
        { id: Number(id) },
        { $set: { stock_delivered_documents: updatedDocs, updated_at: new Date() } },
      );

      const updated = await stockOrderRepository.findById(Number(id));

      return ReS(res, SUCCESS_CODE, "Document deleted successfully.", updated);

    } catch (error: any) {
      console.error("Error in deleteDeliveredDocument:", error);
      return ReE(res, SERVER_ERROR_CODE, error.message);
    }
  }
}

export default new StockOrderController();
