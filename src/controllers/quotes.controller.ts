import {
  BAD_REQUEST_CODE,
  FORBIDDEN_CODE,
  NO_CONTENT,
  RESOURCE_NOT_FOUND,
  SERVER_ERROR_CODE,
  SUCCESS_CODE,
} from "@constants/serverCode";
import {
  generate_Hash_Password,
  generateRandomString,
  generateUUID,
  ReE,
  ReS,
} from "@services/generalHelper.service";
import { Response } from "express";
import { AuthenticatedRequest, newQuote } from "@constants/common.interface";
import {
  invoiceRepository,
  paymentHistoryRepository,
  quoteRepository,
  quoteWorkflowRepository,
  roleRepository,
  stockOrderRepository,
  userRepository,
  visitorLogsRepository,
} from "@repositories";
import { PaymentStatus, QuoteCustomerStatus, UploadCategory } from "@constants/common.enum";
import {
  ALL_PIPELINE_STATUSES,
  normalizePipelineStatus,
  QuotePipelineStatus,
} from "@constants/quotePipeline.constants";
import { fileUpload } from "express-fileupload";
import { s3Service } from "@services/s3.service";
import { sendEventEmail } from "@services/email.service";
import { EVENT_TASK_TYPE } from "@constants/socket.constants";
import { Roles } from "src/data/dataInserter";
import notificationController from "./notification.controller";
import { sendMasterQuoteEmail } from "@services/quoteMasterEmail.service";
import { QuoteEmailType } from "@constants/quoteEmailconstants";
import { advanceQuotePipeline } from "@services/quotePipeline.service";
import { installationScheduledTemplate } from "@template/installationScheduled";
import { installationRescheduledTemplate } from "@template/installationRescheduled";
import { projectCancelledTemplate } from "@template/projectCancelled";
import { stockDeliveryScheduledTemplate } from "@template/stockDeliveryScheduled";
import { getCompanyConfig } from "@services/crmSettings.service";
import { sendEmail } from "@utils/email";
import { isQuoteAdmin } from "@services/adminPermission.service";

import path  from 'path';
import  fs  from 'fs';
import mongoose from "mongoose";
import { uploadFiles } from "@utils/fileUpload.helper";

function formatAuDate(value?: string | Date | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function matchItemCategory(item: any, keywords: string[]) {
  const hay = `${item?.category || ""} ${item?.name || ""} ${item?.description || ""} ${item?.brand || ""}`.toLowerCase();
  return keywords.some((k) => hay.includes(k));
}

function summarizeItems(items: any[], keywords: string[]) {
  const matched = (items || []).filter((it) => matchItemCategory(it, keywords));
  if (!matched.length) return "N/A";
  return matched
    .map((it) => {
      const name = it.name || it.description || "Item";
      const qty = it.quantity != null ? ` × ${it.quantity}` : "";
      return `${name}${qty}`;
    })
    .join(", ");
}

function buildProductListHtml(items: any[]) {
  if (!Array.isArray(items) || !items.length) return "<em>See quote details</em>";
  return items
    .map((it) => {
      const name = it.name || it.description || "Item";
      const qty = it.quantity != null ? ` × ${it.quantity}` : "";
      return `<div>${name}${qty}</div>`;
    })
    .join("");
}

/** Build kanban_status Mongo filter, including legacy SCHEDULED/INSTALLED. */
function pipelineStatusFilter(raw?: string | null): string | { $in: string[] } | undefined {
  if (!raw) return undefined;
  const n = normalizePipelineStatus(raw);
  if (!n) return raw;
  if (n === QuotePipelineStatus.INSTALLATION_SCHEDULED) {
    return { $in: [QuotePipelineStatus.INSTALLATION_SCHEDULED, "SCHEDULED"] };
  }
  if (n === QuotePipelineStatus.INSTALLATION_COMPLETED) {
    return {
      $in: [
        QuotePipelineStatus.INSTALLATION_COMPLETED,
        "INSTALLED",
        "INVOICE_GENERATED",
        "PAYMENT_PENDING",
        "PAYMENT_COMPLETED",
        "PRE_APPROVAL_PENDING",
        "PRE_APPROVAL_APPROVED",
        "GRID_CONNECTION_PENDING",
        "GRID_CONNECTION_COMPLETED",
      ],
    };
  }
  return n;
}

const quoteListPopulate = [
  { path: "customer", select: "id name email mobile_no address profile_image" },
  { path: "sender", select: "id name email mobile_no profile_image" },
  { path: "cf", select: "name email address mobile postcode suburb" },
  { path: "assessment", select: "id token status" },
];

const quoteDetailPopulate = [
  { path: "customer", select: "id name email address mobile_no" },
  { path: "cf", select: "name email address mobile postcode suburb" },
];

const buildQuoteDateFilter = (base: Record<string, unknown>, gte: Date) => ({
  ...base,
  created_at: base.created_at
    ? { ...(base.created_at as object), $gte: gte }
    : { $gte: gte },
});
class QuotesController {
  private readonly baseUploadDir: string;
    private readonly prefixUploadUrl: string = "/uploads/sign";

    constructor() {
      this.baseUploadDir = path.join(process.cwd(), "uploads", "sign");
      if (!fs.existsSync(this.baseUploadDir)) fs.mkdirSync(this.baseUploadDir, { recursive: true });
    }
  async updateOrCreateQuote(data: newQuote, sender_id: number, emailData: any) {
    const {
      customerId: customer_id,
      invoiceNumber,
      currency,
      dateOfDue,
      custName,
      custEmail,
      custMobNum,
      custAddress,
      notes,
      subTotal,
      taxRate,
      taxAmount,
      discountAmount,
      discountRate,
      discountMode,
      total,
      items,
      cf_id = null,
      assessment_id=null,
      distance=null,
      loan_enabled = false,
      loan_meta = null,
      manual_attachments,
      green_sketch,
      is_draft,
      installationType,
      property_type,
      state,
      panelRemoval,
      criticalInstallation,
      garageInstallation,
      extraWiring,
      extraWiringMeters,
      boardUpgrade,
      miniSubboardRequired,
      vpp,
      vppProvider,
      postcode,
      customer_type,
      occupancy,
      installationDate,
      waNetwork,
      solarVicRebate,
      solarVicLoan,
      solarVicEligibleConfirmed,
      vicHotWaterRebate,
      vicHotWaterLocalManufactured,
      waBatteryRebateConfirmed,
      waInterestFreeLoan,
      existingSolar,
      batteryInstallType,
      rebateAmount,
    } = data;

    const payload: any = {
      distance,
      customer_id,
      sender_id,
      currency,
      mobile_no: custMobNum,
      dateOfDue,
      name: custName,
      custEmail,
      custAddress,
      notes: notes ?? "",
      subTotal,
      taxRate,
      taxAmount,
      discountAmount,
      discountRate,
      discountMode: discountMode === "amount" ? "amount" : "rate",
      total,
      loan_enabled,
      loan_meta,
      items,
      cf_id
    };
    if (manual_attachments !== undefined) payload.manual_attachments = manual_attachments;
    if (green_sketch !== undefined) payload.green_sketch = green_sketch;
    if (installationType !== undefined) payload.installationType = installationType;
    if (property_type !== undefined) payload.property_type = property_type;
    if (state !== undefined) payload.state = state;
    if (panelRemoval !== undefined) payload.panelRemoval = !!panelRemoval;
    if (criticalInstallation !== undefined) payload.criticalInstallation = !!criticalInstallation;
    if (garageInstallation !== undefined) payload.garageInstallation = !!garageInstallation;
    if (extraWiring !== undefined) payload.extraWiring = !!extraWiring;
    if (extraWiringMeters !== undefined) payload.extraWiringMeters = extraWiringMeters;
    if (boardUpgrade !== undefined) payload.boardUpgrade = !!boardUpgrade;
    if (miniSubboardRequired !== undefined) payload.miniSubboardRequired = !!miniSubboardRequired;
    if (vpp !== undefined) payload.vpp = !!vpp;
    if (vppProvider !== undefined) payload.vppProvider = vppProvider;
    if (postcode !== undefined) payload.postcode = postcode;
    if (customer_type !== undefined) payload.customer_type = customer_type;
    if (occupancy !== undefined) payload.occupancy = occupancy;
    if (installationDate !== undefined) payload.installationDate = installationDate;
    if (waNetwork !== undefined) payload.waNetwork = waNetwork;
    if (solarVicRebate !== undefined) payload.solarVicRebate = !!solarVicRebate;
    if (solarVicLoan !== undefined) payload.solarVicLoan = !!solarVicLoan;
    if (solarVicEligibleConfirmed !== undefined) payload.solarVicEligibleConfirmed = !!solarVicEligibleConfirmed;
    if (vicHotWaterRebate !== undefined) payload.vicHotWaterRebate = !!vicHotWaterRebate;
    if (vicHotWaterLocalManufactured !== undefined) {
      payload.vicHotWaterLocalManufactured = !!vicHotWaterLocalManufactured;
    }
    if (waBatteryRebateConfirmed !== undefined) payload.waBatteryRebateConfirmed = !!waBatteryRebateConfirmed;
    if (waInterestFreeLoan !== undefined) payload.waInterestFreeLoan = !!waInterestFreeLoan;
    if (existingSolar !== undefined) payload.existingSolar = !!existingSolar;
    if (batteryInstallType !== undefined) payload.batteryInstallType = batteryInstallType;
    if (rebateAmount !== undefined) payload.rebateAmount = Number(rebateAmount) || 0;
    if (!invoiceNumber) {
      payload.kanban_status = is_draft
        ? QuotePipelineStatus.DRAFT
        : QuotePipelineStatus.PENDING;
    }

    let quote;
    let isUpdate = false;
    if (assessment_id && !invoiceNumber) {
      const existingQuote: any = await quoteRepository.findOne({ assessment_id });

      if (existingQuote) throw new Error(`A quote for this assessment already exists. Quote ID: ${existingQuote.id}`);
    }
    if (invoiceNumber) {
      const updateResult = await quoteRepository.updateMany(
        { id: invoiceNumber, customer_id },
        { $set: payload },
      );

      if (updateResult.matchedCount > 0) {
        isUpdate = true;
        quote = await quoteRepository.findOne({ id: invoiceNumber, customer_id });
      } else {
        throw new Error(`Quote #${invoiceNumber} not found for this customer`);
      }
    }

    if (!quote) {
      payload.bypass_token = generateRandomString();
      if(assessment_id) payload.assessment_id=assessment_id
      quote = await quoteRepository.create({ ...payload, address: custAddress });
      await paymentHistoryRepository.create({ quote_id: quote.id })
      await quoteWorkflowRepository.create({ quote_id: quote.id,sales_person_id:sender_id,customer_id,installer_payment_status:PaymentStatus.PENDING,sales_person_payment_status:PaymentStatus.PENDING });
    }
    return { quote, isUpdate };
  }
  async addNew(req: AuthenticatedRequest, res: Response) {
    try {
      const { body } = req;
      const adminData = req.user;
      let customerId = body?.customerId;
      const invoiceNumber = body?.invoiceNumber;
      const emailData: any = {};
      if (!customerId) {
        emailData.email = body.custEmail;
        emailData.client_name = body.custName + `(${body.custEmail})`;
        const existingUser: any = await userRepository.findOne(
          { email: body.custEmail },
          { select: "id", lean: true },
        );

        if (existingUser) {
          customerId = existingUser.id;
        } else {
          const role: any = await roleRepository.findOne(
            { name: Roles.CUSTOMER },
            { select: "id", lean: true },
          );

          const newUser: any = await userRepository.create({
            username: body.custEmail.toLowerCase(),
            email: body.custEmail.toLowerCase(),
            name: body.custName,
            address: body.custAddress,
            password: await generate_Hash_Password(body.custEmail),
            mobile_no: body.custMobNum,
            role_id: role?.id,
          });

          customerId = newUser.id;
        }
      }

      const { quote, isUpdate } = await this.updateOrCreateQuote(
        {
          ...body,
          customerId,
          invoiceNumber,
        },
        adminData.id,
        emailData,
      );

      ReS(res, SUCCESS_CODE, "Quote processed successfully", quote);
      return (async () => {
        try {
          await notificationController.createNotification({
            userId: adminData.id,
            message: isUpdate
              ? `Quotation #${quote.id} has been updated.`
              : `New Quotation #${quote.id} has been created.`,
            route: `${process.env.FRONT_URL}/#/quote/customer-view/${quote.id}/${quote.bypass_token}`,
            meta: {
              customerId: quote.customer_id,
              customerName: quote.custName,
              type: "QUOTE",
              senderName: adminData.name,
              role: adminData.role
            }
          })
          // Email only when explicitly requested (Send quote / Send to customer)
          if (body.send_email === true || body.send_email === "true") {
            await sendMasterQuoteEmail({
              quote_id: quote.id,
              type: isUpdate ? QuoteEmailType.UPDATED : QuoteEmailType.CREATED,
            }, body.isAttachAssessmentWithQuoteMail)
          }
        } catch (err) {
          console.error("Email sending failed:", err.message);
        }
      })();

    } catch (error) {
      console.error("Error in addNew:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const { body } = req;
      const adminData = req.user;
      let customerId = body?.customerId;
      const invoiceNumber = body?.invoiceNumber;
      const { quote } = await this.updateOrCreateQuote(
        {
          ...body,
          customerId,
          invoiceNumber,
          name: body.custName,
          mobile_no: body.custMobNum,
        },
        adminData.id,
        {}
      );
      ReS(res, SUCCESS_CODE, "Quote updated successfully", quote);
      if (body.send_email === true || body.send_email === "true") {
        return (async () => {
          try {
            await sendMasterQuoteEmail({
              quote_id: quote.id,
              type: QuoteEmailType.UPDATED,
            }, body.isAttachAssessmentWithQuoteMail);
          } catch (err: any) {
            console.error("Email sending failed:", err?.message);
          }
        })();
      }
      return;
    } catch (error) {
      console.error("Error in Update:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }
  async getQuotes(req: AuthenticatedRequest, res: Response) {
    try {
      const { user } = req;
      const {
        limit = 10,
        page = 1,
        sender_name = '',
        cust_name = null,
        cust_email = null,
        status,
        start_date,
        end_date,
        order_by = 'created_at',
        order_direction = 'DESC',
        kanban_status =null,
        pipeline_status = null,
        year= null,
        quote_type = 'all',
      } = req.body;
      const parsedLimit = parseInt(limit as string, 10);
      const parsedPage = parseInt(page as string, 10);

      // Prepare customer filter
      let customerIds: number[] | null = null;
      let senderIds: number[] | null = null;

      if (cust_name || cust_email) {
        const userFilter: Record<string, unknown>[] = [];
        if (cust_name) userFilter.push({ name: { $regex: cust_name, $options: "i" } });
        if (cust_email) userFilter.push({ email: { $regex: cust_email, $options: "i" } });
        const customers: any[] = await userRepository.find(
          { $or: userFilter },
          { select: "id", lean: true },
        );

        if (!customers || customers.length === 0) {
          return ReE(res, SERVER_ERROR_CODE, "Customer not found");
        }

        customerIds = customers.map((c) => c.id);
      }
      if (sender_name) {
        const senders: any[] = await userRepository.find(
          { name: { $regex: sender_name, $options: "i" } },
          { select: "id", lean: true },
        );

        if (!senders || senders.length === 0) {
          return ReE(res, SERVER_ERROR_CODE, "Sender not found");
        }
        senderIds = senders.map((s) => s.id);
      }

      const filter: Record<string, unknown> = {};
      const normalizedQuoteType = String(quote_type || 'all').toLowerCase();
      if (normalizedQuoteType === 'solar_sketch' || normalizedQuoteType === 'solar') {
        filter.is_solar_sketch = true;
      } else if (normalizedQuoteType === 'normal') {
        filter.is_solar_sketch = { $ne: true };
      }
      if (!(await isQuoteAdmin(user))) {
        
        filter.$or = [{ sender_id: user.id }, { customer_id: user.id }]
      }
      if (customerIds) filter.customer_id = { $in: customerIds };
      if (senderIds && senderIds.length > 0) filter.sender_id = { $in: senderIds };
      if (status) filter.customer_accepted = status;
      if (start_date && end_date) 
        filter.created_at = {
          $gte: new Date(start_date),
          $lte: new Date(end_date),
        };
      const pipelineFilter = pipelineStatusFilter(pipeline_status || kanban_status);
      if (pipelineFilter) filter.kanban_status = pipelineFilter;
      
      if(year){
        const yearNumber = Number(year);
        if (!isNaN(yearNumber)) {
           const startOfYear = new Date(yearNumber, 0, 1);
           const endOfYear = new Date(yearNumber + 1, 0, 1);
            filter.created_at = {
        ...(filter.created_at as object || {}),
        $gte: startOfYear,
        $lt: endOfYear,
      };
        }
      }
      

      const sortDir = order_direction === "ASC" ? 1 : -1;
      const { count, rows: quotes } = await quoteRepository.findPaginated(filter, {
        page: parsedPage,
        limit: parsedLimit,
        sort: { [order_by]: sortDir } as Record<string, 1 | -1>,
        populate: quoteListPopulate,
        lean: true,
      });
      const quoteIds = quotes.map((q: any) => q.id);

      const [visitorLogs, stockOrders]: any = await Promise.all([
        visitorLogsRepository.find(
          { quote_id: { $in: quoteIds } },
          { lean: true },
        ),
        stockOrderRepository.find(
          { quote_id: { $in: quoteIds } },
          {
            select: "id quote_id stock_order_status bypass_token stock_confirm_date stock_delivered_date stock_order_date driver_name created_at updated_at",
            lean: true,
          },
        )
      ]);

      // BUILD LOOKUP MAPS (O(n))
      const visitorMap = Object.create(null);
      for (const log of visitorLogs) {
        visitorMap[log.quote_id] = log; // or push to array if multiple
      }

      const stockOrderMap = Object.create(null);
      for (const so of stockOrders) {
        stockOrderMap[so.quote_id] = so;
      }

      // MERGE QUOTES (O(n), SUPER FAST)
      const mergedQuotes = quotes.map((q: any) => ({
        ...q,
        logs: visitorMap[q.id] ?? null,
        stock_order: stockOrderMap[q.id] ?? null,
      }));

      return ReS(res, SUCCESS_CODE, "Quotes fetched successfully", {
        currentPage: parsedPage,
        totalPages: Math.ceil(count / parsedLimit),
        limit: parsedLimit,
        totalQuotes: count,
        data: mergedQuotes,
      });
    } catch (error: any) {
      console.error("Error in getQuotes:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }
  async getQuoteById(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const bypass_token = req.bypass_token;
      const filters: any = { id };
      if (!id) return ReE(res, SERVER_ERROR_CODE, "Quote ID is required");
      if (bypass_token) filters.bypass_token = bypass_token

      const quote = await quoteRepository.findOne(
        { ...filters },
        { populate: quoteDetailPopulate },
      );

      if (!quote) {
        return ReE(res, SERVER_ERROR_CODE, "Quote not found");
      }

      return ReS(res, SUCCESS_CODE, "Quote fetched successfully", quote);
    } catch (error: any) {
      console.error("Error in getQuoteById:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }
  async deleteQuote(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return ReE(res, SERVER_ERROR_CODE, "Quote ID is required");
      }
      let deleteFilter: Record<string, unknown> = { id: Number(id), sender_id: req.user.id };
     if(req.user.role==Roles.SUPER_ADMIN){
      deleteFilter = { id: Number(id) }
     }
      const quote = await quoteRepository.findOne(deleteFilter);

      if (!quote) {
        return ReE(
          res,
          SERVER_ERROR_CODE,
          "Quote not found or you do not have permission to delete it",
        );
      }

      await quoteRepository.deleteById(Number(id));

      await stockOrderRepository.deleteMany({ quote_id: Number(id) });

      await notificationController.createNotification({
        userId: req.user.id,
        message: `Quotation #${id} has been deleted.`,
        route: null,
        meta: {
          type: "QUOTE",
          senderName: req.user.name,
          role: req.user.role
        }
      });
      return ReS(res, SUCCESS_CODE, "Quote deleted successfully");
    } catch (error: any) {
      console.error("Error in deleteQuote:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }
  async getQuotesAnalysis(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        user: { id: userId },
      } = req;

      // ── FILTERS from query params ──
      const {
        start_date,
        end_date,
        status,
        currency,
        min_amount,
        max_amount,
      } = req.query as {
        start_date?: string;
        end_date?: string;
        status?: string;          // e.g. "ACCEPTED" or "ACCEPTED,PENDING"
        currency?: string;
        min_amount?: string;
        max_amount?: string;
      };

      const baseFilter: Record<string, unknown> = { deleted_at: null, is_solar_sketch: { $ne: true } };
      if (start_date && end_date) {
        baseFilter.created_at = { $gte: new Date(start_date), $lte: new Date(end_date) };
      } else if (start_date) {
        baseFilter.created_at = { $gte: new Date(start_date) };
      } else if (end_date) {
        baseFilter.created_at = { $lte: new Date(end_date) };
      }
      if (status) {
        const statuses = status.split(",").map((s: string) => s.trim()).filter(Boolean);
        if (statuses.length === 1) baseFilter.customer_accepted = statuses[0];
        else if (statuses.length > 1) baseFilter.customer_accepted = { $in: statuses };
      }
      if (currency) baseFilter.currency = currency;
      if (min_amount || max_amount) {
        baseFilter.total = {
          ...(min_amount && { $gte: Number(min_amount) }),
          ...(max_amount && { $lte: Number(max_amount) }),
        };
      }

      const now = new Date();
      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      startOfWeek.setDate(now.getDate() - diffToMonday);
      startOfWeek.setHours(0, 0, 0, 0);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
      const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);

      const [
        totalStatsRows,
        weekCount,
        monthCount,
        yearCount,
        previousYearCount,
        acceptedCount,
        rejectedCount,
        monthlyStats,
        financialSummaryRows,
        topCustomers,
        acceptedDateStats,
      ]: any = await Promise.all([
        quoteRepository.aggregateRaw([
          { $match: baseFilter },
          {
            $group: {
              _id: null,
              total_quotes: { $sum: 1 },
              total_amount: { $sum: "$total" },
            },
          },
        ]),
        quoteRepository.count(buildQuoteDateFilter(baseFilter, startOfWeek)),
        quoteRepository.count(buildQuoteDateFilter(baseFilter, startOfMonth)),
        quoteRepository.count(buildQuoteDateFilter(baseFilter, startOfYear)),
        quoteRepository.count({
          ...baseFilter,
          created_at: { $gte: startOfLastYear, $lte: endOfLastYear },
        }),
        quoteRepository.count({ ...baseFilter, customer_accepted: QuoteCustomerStatus.ACCEPTED }),
        quoteRepository.count({ ...baseFilter, customer_accepted: QuoteCustomerStatus.REJECTED }),
        quoteRepository.aggregateRaw([
          { $match: baseFilter },
          {
            $group: {
              _id: { $dateToString: { format: "%b %Y", date: "$created_at" } },
              quoteCount: { $sum: 1 },
              totalAmount: { $sum: "$total" },
              totalTax: { $sum: "$taxAmount" },
              totalDiscount: { $sum: "$discountAmount" },
              avgAmount: { $avg: "$total" },
              acceptedCount: {
                $sum: { $cond: [{ $eq: ["$customer_accepted", QuoteCustomerStatus.ACCEPTED] }, 1, 0] },
              },
              rejectedCount: {
                $sum: { $cond: [{ $eq: ["$customer_accepted", QuoteCustomerStatus.REJECTED] }, 1, 0] },
              },
              expiredCount: {
                $sum: { $cond: [{ $eq: ["$customer_accepted", QuoteCustomerStatus.EXPIRED] }, 1, 0] },
              },
              pendingCount: {
                $sum: { $cond: [{ $eq: ["$customer_accepted", QuoteCustomerStatus.PENDING] }, 1, 0] },
              },
              sortDate: { $min: "$created_at" },
            },
          },
          { $sort: { sortDate: 1 } },
          {
            $project: {
              _id: 0,
              month: "$_id",
              quoteCount: 1,
              totalAmount: 1,
              totalTax: 1,
              totalDiscount: 1,
              avgAmount: 1,
              acceptedCount: 1,
              rejectedCount: 1,
              expiredCount: 1,
              pendingCount: 1,
            },
          },
        ]),
        quoteRepository.aggregateRaw([
          { $match: baseFilter },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: "$total" },
              totalTax: { $sum: "$taxAmount" },
              totalDiscount: { $sum: "$discountAmount" },
              avgQuoteValue: { $avg: "$total" },
              maxQuoteValue: { $max: "$total" },
              minQuoteValue: { $min: "$total" },
            },
          },
        ]),
        quoteRepository.aggregateRaw([
          { $match: baseFilter },
          {
            $lookup: {
              from: "users",
              localField: "customer_id",
              foreignField: "id",
              as: "user",
            },
          },
          { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
          {
            $group: {
              _id: "$customer_id",
              name: { $first: "$user.name" },
              email: { $first: "$user.email" },
              quoteCount: { $sum: 1 },
              totalValue: { $sum: "$total" },
            },
          },
          { $sort: { totalValue: -1 } },
          { $limit: 5 },
          {
            $project: {
              _id: 0,
              id: "$_id",
              name: 1,
              email: 1,
              quoteCount: 1,
              totalValue: 1,
            },
          },
        ]),
        quoteRepository.aggregateRaw([
          {
            $match: {
              deleted_at: null,
              customer_accepted: QuoteCustomerStatus.ACCEPTED,
              ...(start_date || end_date
                ? {
                    $expr: {
                      $and: [
                        ...(start_date
                          ? [{ $gte: [{ $ifNull: ["$accepted_date", "$updated_at"] }, new Date(start_date)] }]
                          : []),
                        ...(end_date
                          ? [{ $lte: [{ $ifNull: ["$accepted_date", "$updated_at"] }, new Date(end_date)] }]
                          : []),
                      ],
                    },
                  }
                : {}),
            },
          },
          {
            $addFields: {
              acceptedAt: { $ifNull: ["$accepted_date", "$updated_at"] },
            },
          },
          {
            $group: {
              _id: { $dateToString: { format: "%b %Y", date: "$acceptedAt" } },
              acceptedCount: { $sum: 1 },
              acceptedRevenue: { $sum: "$total" },
              avgDaysToAccept: {
                $avg: {
                  $divide: [
                    { $subtract: ["$acceptedAt", "$created_at"] },
                    1000 * 60 * 60 * 24,
                  ],
                },
              },
              sortDate: { $min: "$acceptedAt" },
            },
          },
          { $sort: { sortDate: 1 } },
          {
            $project: {
              _id: 0,
              month: "$_id",
              acceptedCount: 1,
              acceptedRevenue: 1,
              avgDaysToAccept: 1,
            },
          },
        ]),
      ]);

      const totalStats = totalStatsRows[0] || {};
      const financialSummary = financialSummaryRows[0] || {};

      const latestQuotes = await quoteRepository.find(baseFilter, {
        select: "id total subTotal taxAmount discountAmount customer_accepted accepted_date created_at updated_at currency name",
        populate: { path: "customer", select: "id name email" },
        sort: { created_at: -1 },
        limit: 10,
        lean: true,
      });

      const analysis = {
        totalQuotes: Number(totalStats.total_quotes || 0),
        totalAmount: Number(totalStats.total_amount || 0),
        runningWeekQuotes: weekCount,
        runningMonthQuotes: monthCount,
        runningYearQuotes: yearCount,
        previousYearQuotes: previousYearCount,
        acceptedQuotes: acceptedCount,
        rejectedQuotes: rejectedCount,
        monthlyQuoteStats: monthlyStats,
        latestQuotes,
        financialSummary: {
          totalRevenue: Number(financialSummary.totalRevenue || 0),
          totalTax: Number(financialSummary.totalTax || 0),
          totalDiscount: Number(financialSummary.totalDiscount || 0),
          avgQuoteValue: Math.round(Number(financialSummary.avgQuoteValue || 0)),
          maxQuoteValue: Number(financialSummary.maxQuoteValue || 0),
          minQuoteValue: Number(financialSummary.minQuoteValue || 0),
        },
        topCustomers: topCustomers.map((c: any) => ({
          id: c.id,
          name: c.name || "Unknown",
          email: c.email || "",
          quoteCount: Number(c.quoteCount),
          totalValue: Number(c.totalValue),
        })),
        acceptedDateStats: acceptedDateStats.map((r: any) => ({
          month: r.month,
          acceptedCount: Number(r.acceptedCount),
          acceptedRevenue: Number(r.acceptedRevenue),
          avgDaysToAccept: Math.round(Number(r.avgDaysToAccept || 0)),
        })),
        appliedFilters: { start_date, end_date, status, currency, min_amount, max_amount },
      };

      return ReS(
        res,
        SUCCESS_CODE,
        "Quote analysis fetched successfully",
        analysis,
      );
    } catch (error) {
      console.error("Error in getQuotesAnalysis:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }
  async getQuoteStatusGraphData(req: AuthenticatedRequest, res: Response) {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const startOfWeek = new Date(startOfDay);
      const day = startOfWeek.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      const aggregatePeriod = (dateFilter: Record<string, unknown>) =>
        quoteRepository.aggregateRaw([
          {
            $match: {
              deleted_at: null,
              is_solar_sketch: { $ne: true },
              customer_accepted: QuoteCustomerStatus.ACCEPTED,
              ...dateFilter,
            },
          },
          {
            $group: {
              _id: "$customer_accepted",
              totalQuotes: { $sum: 1 },
              totalAmount: { $sum: "$total" },
              totalTax: { $sum: "$taxAmount" },
              totalDiscount: { $sum: "$discountAmount" },
            },
          },
          {
            $project: {
              _id: 0,
              status: "$_id",
              totalQuotes: 1,
              totalAmount: 1,
              totalTax: 1,
              totalDiscount: 1,
            },
          },
        ]);

      const results = await Promise.all([
        aggregatePeriod({ created_at: { $gte: startOfDay, $lt: endOfDay } }),
        aggregatePeriod({ created_at: { $gte: startOfWeek } }),
        aggregatePeriod({ created_at: { $gte: startOfMonth } }),
        aggregatePeriod({ created_at: { $gte: startOfYear } }),
      ]);

      const formatResult = (data: any[], label: string) =>
        data.map((row) => ({
          status: row.status,
          period: label,
          totalQuotes: Number(row.totalQuotes),
          totalAmount: Number(row.totalAmount),
          totalTax: Number(row.totalTax),
          totalDiscount: Number(row.totalDiscount),
        }));

      return ReS(res, 200, "Quote status graph data fetched", {
        thisDay: formatResult(results[0], "Today"),
        thisWeek: formatResult(results[1], "This Week"),
        thisMonth: formatResult(results[2], "This Month"),
        thisYear: formatResult(results[3], "This Year"),
      });
    } catch (error: any) {
      console.error("Error in getQuoteStatusGraphData:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }
  async updateCustomerQuoteStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const files = req.files as fileUpload.FileArray | undefined;
      const { status, id, reason } = req.body;
      let invoiceData: any = {
        quote_id: id, pay_status: PaymentStatus.PENDING,
        sender_id: null, bypass_token: null,
        dateOfDue: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // due in 15 days address:null
        name: null, mobile_no: null
      }
      if (!status || !id) {
        return ReE(
          res,
          FORBIDDEN_CODE,
          "Missing required fields: status or id.",
        );
      }
      const existing: any = await quoteRepository.findOne(
        { id },
        {
          populate: [
            { path: "customer", select: "id name email" },
            { path: "sender", select: "id name email" },
          ],
          lean: true,
        },
      );
      if (!existing) return ReE(res, FORBIDDEN_CODE, "Quote not found.");

      if (req.bypass_token) {
        if (req.bypass_token !== existing.bypass_token) {
          return ReE(res, FORBIDDEN_CODE, "Invalid access token.");
        }
      } else if (req.user?.id !== existing.customer_id && req.user?.role !== Roles.SUPER_ADMIN) {
        return ReE(res, FORBIDDEN_CODE, "Unauthorized.");
      }

      const now = new Date();
      const updateData: any = { customer_accepted: status, status_updated_date: now };

      if (status === QuoteCustomerStatus.REJECTED) {
        if (!reason) {
          return ReE(res, FORBIDDEN_CODE, "Rejection reason is required.");
        }
        updateData.reason = reason;
      }

      if (status === QuoteCustomerStatus.ACCEPTED) {
        if (!files?.signature) {
          return ReE(res, FORBIDDEN_CODE, "No file uploaded.");
        }

        const file = files?.signature as fileUpload.UploadedFile;

        const fileName = `quote-sign-${id}-${generateUUID()}`;
        const destPath = path.join(this.baseUploadDir, fileName);
        try {
          await new Promise<void>((resolve, reject) => {
            file.mv(destPath, (err: Error | null) => (err ? reject(err) : resolve()));
          });
        } catch (err) {
          console.error("File move error:", err);
          return ReE(res, SERVER_ERROR_CODE, "File upload failed.");
        }
        const fileUrl = `${process.env.BASE_URL}${this.prefixUploadUrl}/${fileName}`;

        updateData.customerSignatureUrl = fileUrl;
        updateData.accepted_date = now;
        updateData.signed_date = now;
        invoiceData.address = existing.address;
        invoiceData.sender_id = existing.sender_id;
        invoiceData.bypass_token = existing.bypass_token;
        invoiceData.name = existing.name;
        invoiceData.mobile_no = existing.mobile_no;
      }

      await quoteRepository.updateMany({ id }, { $set: updateData });

      // Sync pipeline status from customer decision
      if (status === QuoteCustomerStatus.ACCEPTED) {
        await advanceQuotePipeline(Number(id), QuotePipelineStatus.ACCEPTED, {
          reason: "customer_accepted",
          actorId: existing.customer_id,
        });
      } else if (
        status === QuoteCustomerStatus.REJECTED ||
        status === QuoteCustomerStatus.EXPIRED ||
        status === QuoteCustomerStatus.DEAD
      ) {
        await advanceQuotePipeline(Number(id), QuotePipelineStatus.DECLINED_CANCELLED, {
          reason: `customer_${String(status).toLowerCase()}`,
          actorId: existing.customer_id,
          force: true,
        });
      }

      const customer = existing.customer ?? null;
      const sender = existing.sender ?? null;
      const emailData = customer?.email
        ? {
            email: customer.email,
            subject: `📄 Your Quote Status Has Been Updated to ${status}`,
            client_name: customer.name ?? "Customer",
            id: existing.id,
            type: "QUOTE",
            title: `Quotation #${existing.id}`,
            status: status,
            due_date: existing.dateOfDue,
            link: `${process.env.FRONT_URL}/#/quote/customer-view/${existing.id}/${existing.bypass_token}`,
            event: EVENT_TASK_TYPE.UPDATED,
          }
        : null;
      const invoiceEmailData = emailData ? { ...emailData } : null;
      let created_invoice;
      if (status === QuoteCustomerStatus.ACCEPTED) {
        const existingInvoice = await invoiceRepository.findOne({ quote_id: id });
        if (!existingInvoice) {
          created_invoice = await invoiceRepository.create(invoiceData);
          const workFlowData = await quoteWorkflowRepository.findOne({ quote_id: id });
          if (workFlowData) 
            await quoteWorkflowRepository.updateMany({ quote_id: id }, { $set: { invoice_id: created_invoice.id } });
        }
      }
      ReS(res, SUCCESS_CODE, "Quote status updated successfully.");
      if (customer?.id) {
        await notificationController.createNotification({
          userId: customer.id,
          message: `Quotation #${existing.id} status has been updated to ${status}.`,
          route: `${process.env.FRONT_URL}/#/quote/customer-view/${existing.id}/${existing.bypass_token}`,
          meta: {
            type: "QUOTE",
            senderName: sender?.name ?? "Team",
            customerNamwe: customer.name,
            role: sender?.role,
          },
        });
      }
      await sendMasterQuoteEmail({
        quote_id: existing.id,
        type: QuoteEmailType.STATUS_UPDATED,
      });
      if (created_invoice && customer?.id && invoiceEmailData) {
        await notificationController.createNotification({
          userId: customer.id,
          message: `Invoice #${created_invoice.id} has been created for Quotation #${existing.id}.`,
          route: `${process.env.FRONT_URL}/#/invoice/customer-view/${created_invoice.id}/${created_invoice.bypass_token}`,
          meta: {
            type: "INVOICE",
            senderName: sender?.name ?? "Team",
            customerName: customer.name,
            role: sender?.role,
          },
        });
        invoiceEmailData.subject = `🧾 Your Invoice #${created_invoice.id} Has Been Created for Accepted Quote #${existing.id}`;
        invoiceEmailData.id = created_invoice.id;
        invoiceEmailData.type = "INVOICE";
        invoiceEmailData.title = `Invoice #${created_invoice.id}`;
        invoiceEmailData.link = `${process.env.FRONT_URL}/#/invoice/customer-view/${created_invoice.id}/${created_invoice.bypass_token}`;
        invoiceEmailData.event = EVENT_TASK_TYPE.CREATED;
        invoiceEmailData.due_date = created_invoice.dateOfDue;
        invoiceEmailData.status = created_invoice.pay_status;
        await sendEventEmail(invoiceEmailData);
      }
    } catch (error: any) {
      console.error("updateCustomerQuoteStatus Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }
  async getQuoteAnalysisQuoteId(req: AuthenticatedRequest, res: Response) {
    try {
      const quoteId = req.query.quoteId;
      if (!quoteId)
        ReE(res, BAD_REQUEST_CODE, "quoteid not null or undefined")
      const [quoteData, invoiceData]: any = await Promise.all([
        quoteRepository.findOne(
          { id: Number(quoteId) },
          {
            populate: { path: "customer", select: "id name email profile_image" },
            lean: true,
          },
        ),
        invoiceRepository.findOne(
          { quote_id: Number(quoteId) },
          { select: "id pay_status partialAmount", lean: true },
        ),
      ]);
      const resData = {
        customer: quoteData?.customer,
        quote_status: quoteData?.customer_accepted,
        totalAmount: quoteData?.total,
        taxAmount: quoteData?.taxAmount,
        discountAmount: quoteData?.discountAmount,
        pay_status: invoiceData?.pay_status,
        partialAmount: invoiceData?.partialAmount,
        isInvoiceCreated: invoiceData ? true : false
      }
      ReS(res, SUCCESS_CODE, "Quote information fetch successfully!", resData)
    } catch (error) {
      console.error("Error in getQuoteAllInfoByQuoteId:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }
 async addAttachments(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.files) {
      return ReE(res, BAD_REQUEST_CODE, "No attachments provided");
    }

    const attachments: string[] = [];

    const filesMap = req.files as fileUpload.FileArray;

    for (const key in filesMap) {
      const file = filesMap[key];
      const fileArray = Array.isArray(file) ? file : [file];

      const uploaded = await uploadFiles({
        category: null,
        files: fileArray,
        entityId: req.body.quote_id ?? "temp",
        multiple: true,
        maxSizeMB: 10,
      });

      // 🔥 only push URLs
      uploaded.forEach((f: any) => attachments.push(f.url));
    }

    return ReS(
      res,
      SUCCESS_CODE,
      "Attachment successfully added",
      attachments
    );
  } catch (err: any) {
    console.error("addAttachments error:", err);
    return ReE(
      res,
      SERVER_ERROR_CODE,
      err.message || "Failed to add Attachment"
    );
  }
}

  async updateManualAttachments(req: AuthenticatedRequest, res: Response) {
    try {
      const quoteId = Number(req.params.quoteId);
      const { attachments } = req.body;

      if (!quoteId || Number.isNaN(quoteId)) {
        return ReE(res, BAD_REQUEST_CODE, "Valid quoteId is required");
      }
      if (!Array.isArray(attachments)) {
        return ReE(res, BAD_REQUEST_CODE, "attachments must be an array");
      }

      const quote = await quoteRepository.findById(quoteId);
      if (!quote) return ReE(res, RESOURCE_NOT_FOUND, "Quote not found");

      await quoteRepository.updateById(quoteId, { $set: { manual_attachments: attachments } });
      return ReS(res, SUCCESS_CODE, "Manual attachments updated", {
        manual_attachments: attachments,
      });
    } catch (err: any) {
      console.error("updateManualAttachments error:", err);
      return ReE(res, SERVER_ERROR_CODE, err.message || "Failed to update attachments");
    }
  }

  async updateGreenSketch(req: AuthenticatedRequest, res: Response) {
    try {
      const quoteId = Number(req.params.quoteId);
      const { green_sketch } = req.body;

      if (!quoteId || Number.isNaN(quoteId)) {
        return ReE(res, BAD_REQUEST_CODE, "Valid quoteId is required");
      }
      if (green_sketch === undefined) {
        return ReE(res, BAD_REQUEST_CODE, "green_sketch payload is required");
      }

      const quote = await quoteRepository.findById(quoteId);
      if (!quote) return ReE(res, RESOURCE_NOT_FOUND, "Quote not found");

      const payload =
        green_sketch === null
          ? null
          : {
              ...green_sketch,
              savedAt: green_sketch?.savedAt || new Date().toISOString(),
              version: green_sketch?.version || 1,
            };

      await quoteRepository.updateById(quoteId, { $set: { green_sketch: payload } });
      return ReS(res, SUCCESS_CODE, "Solar Sketch layout saved", {
        green_sketch: payload,
      });
    } catch (err: any) {
      console.error("updateGreenSketch error:", err);
      return ReE(res, SERVER_ERROR_CODE, err.message || "Failed to save Solar Sketch layout");
    }
  }

  /** Normalises a Solar Sketch layout blob, stamping version + savedAt. */
  private normalizeSketch(green_sketch: any) {
    if (green_sketch === undefined) return undefined;
    if (green_sketch === null) return null;
    return {
      ...green_sketch,
      savedAt: green_sketch?.savedAt || new Date().toISOString(),
      version: green_sketch?.version || 1,
    };
  }

  /**
   * Create or update a standalone Solar Sketch solar quote.
   * These are kept separate from normal quotations via `is_solar_sketch`.
   */
  async createSolarQuote(req: AuthenticatedRequest, res: Response) {
    try {
      const { body } = req;
      const adminData = req.user;
      const {
        solarQuoteId,
        custName,
        custEmail,
        custMobNum,
        custAddress,
        green_sketch,
        items,
        notes,
        currency,
        taxRate,
        taxAmount,
        discountRate,
        discountAmount,
        discountMode,
        subTotal,
        total,
        loan_enabled,
        loan_meta,
        installationType,
        rebateAmount,
        panelRemoval,
        criticalInstallation,
        garageInstallation,
        extraWiring,
        extraWiringMeters,
        boardUpgrade,
        miniSubboardRequired,
        vpp,
        vppProvider,
        postcode,
        customer_type,
        occupancy,
        installationDate,
        waNetwork,
        solarVicRebate,
        solarVicLoan,
        solarVicEligibleConfirmed,
        vicHotWaterRebate,
        vicHotWaterLocalManufactured,
        waBatteryRebateConfirmed,
        waInterestFreeLoan,
        existingSolar,
        batteryInstallType,
        property_type,
        send_email,
      } = body;
      let customerId = body?.customerId;

      const pricingPatch: Record<string, unknown> = {};
      if (items !== undefined) pricingPatch.items = items;
      if (notes !== undefined) pricingPatch.notes = notes ?? "";
      if (currency !== undefined) pricingPatch.currency = currency;
      if (taxRate !== undefined) pricingPatch.taxRate = Number(taxRate) || 0;
      if (taxAmount !== undefined) pricingPatch.taxAmount = Number(taxAmount) || 0;
      if (discountRate !== undefined) pricingPatch.discountRate = Number(discountRate) || 0;
      if (discountAmount !== undefined) pricingPatch.discountAmount = Number(discountAmount) || 0;
      if (discountMode !== undefined) {
        pricingPatch.discountMode = discountMode === "amount" ? "amount" : "rate";
      }
      if (subTotal !== undefined) pricingPatch.subTotal = Number(subTotal) || 0;
      if (total !== undefined) pricingPatch.total = Number(total) || 0;
      if (loan_enabled !== undefined) pricingPatch.loan_enabled = !!loan_enabled;
      if (loan_meta !== undefined) pricingPatch.loan_meta = loan_meta;
      if (installationType !== undefined) pricingPatch.installationType = installationType;
      if (rebateAmount !== undefined) pricingPatch.rebateAmount = Number(rebateAmount) || 0;
      if (panelRemoval !== undefined) pricingPatch.panelRemoval = !!panelRemoval;
      if (criticalInstallation !== undefined) pricingPatch.criticalInstallation = !!criticalInstallation;
      if (garageInstallation !== undefined) pricingPatch.garageInstallation = !!garageInstallation;
      if (extraWiring !== undefined) pricingPatch.extraWiring = !!extraWiring;
      if (extraWiringMeters !== undefined) pricingPatch.extraWiringMeters = extraWiringMeters;
      if (boardUpgrade !== undefined) pricingPatch.boardUpgrade = !!boardUpgrade;
      if (miniSubboardRequired !== undefined) pricingPatch.miniSubboardRequired = !!miniSubboardRequired;
      if (vpp !== undefined) pricingPatch.vpp = !!vpp;
      if (vppProvider !== undefined) pricingPatch.vppProvider = vppProvider;
      if (postcode !== undefined) pricingPatch.postcode = postcode;
      if (customer_type !== undefined) pricingPatch.customer_type = customer_type;
      if (occupancy !== undefined) pricingPatch.occupancy = occupancy;
      if (installationDate !== undefined) pricingPatch.installationDate = installationDate;
      if (waNetwork !== undefined) pricingPatch.waNetwork = waNetwork;
      if (solarVicRebate !== undefined) pricingPatch.solarVicRebate = !!solarVicRebate;
      if (solarVicLoan !== undefined) pricingPatch.solarVicLoan = !!solarVicLoan;
      if (solarVicEligibleConfirmed !== undefined) {
        pricingPatch.solarVicEligibleConfirmed = !!solarVicEligibleConfirmed;
      }
      if (vicHotWaterRebate !== undefined) pricingPatch.vicHotWaterRebate = !!vicHotWaterRebate;
      if (vicHotWaterLocalManufactured !== undefined) {
        pricingPatch.vicHotWaterLocalManufactured = !!vicHotWaterLocalManufactured;
      }
      if (waBatteryRebateConfirmed !== undefined) {
        pricingPatch.waBatteryRebateConfirmed = !!waBatteryRebateConfirmed;
      }
      if (waInterestFreeLoan !== undefined) pricingPatch.waInterestFreeLoan = !!waInterestFreeLoan;
      if (existingSolar !== undefined) pricingPatch.existingSolar = !!existingSolar;
      if (batteryInstallType !== undefined) pricingPatch.batteryInstallType = batteryInstallType;
      if (property_type !== undefined) pricingPatch.property_type = property_type;

      // ── Update path ──
      if (solarQuoteId) {
        const existing: any = await quoteRepository.findOne({ id: Number(solarQuoteId) });
        if (!existing) return ReE(res, RESOURCE_NOT_FOUND, "Solar quote not found");

        const update: any = { is_solar_sketch: true, ...pricingPatch };
        const sketch = this.normalizeSketch(green_sketch);
        if (sketch !== undefined) update.green_sketch = sketch;
        if (custName) update.name = custName;
        if (custMobNum) update.mobile_no = custMobNum;
        if (custAddress) {
          update.address = custAddress;
        }
        if (customerId) update.customer_id = customerId;

        await quoteRepository.updateById(Number(solarQuoteId), { $set: update });
        const quote = await quoteRepository.findOne(
          { id: Number(solarQuoteId) },
          { populate: quoteListPopulate, lean: true },
        );
        if (send_email === true || send_email === "true") {
          (async () => {
            try {
              await sendMasterQuoteEmail({
                quote_id: String(solarQuoteId),
                type: QuoteEmailType.UPDATED,
              });
            } catch (err: any) {
              console.error("Solar quote email failed:", err?.message);
            }
          })();
        }
        return ReS(res, SUCCESS_CODE, "Solar quote saved", quote);
      }

      // ── Create path — resolve or create the customer ──
      if (!customerId && custEmail) {
        const existingUser: any = await userRepository.findOne(
          { email: custEmail },
          { select: "id", lean: true },
        );
        if (existingUser) {
          customerId = existingUser.id;
        } else {
          const role: any = await roleRepository.findOne(
            { name: Roles.CUSTOMER },
            { select: "id", lean: true },
          );
          const newUser: any = await userRepository.create({
            username: custEmail.toLowerCase(),
            email: custEmail.toLowerCase(),
            name: custName || custEmail,
            address: custAddress,
            password: await generate_Hash_Password(custEmail),
            mobile_no: custMobNum,
            role_id: role?.id,
          });
          customerId = newUser.id;
        }
      }

      const now = new Date();
      const payload: any = {
        customer_id: customerId,
        sender_id: adminData.id,
        currency: currency || "AUD",
        dateOfDue: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        name: custName || "Solar Sketch",
        mobile_no: custMobNum,
        address: custAddress,
        notes: notes ?? "",
        subTotal: Number(subTotal) || 0,
        taxRate: Number(taxRate) || 0,
        taxAmount: Number(taxAmount) || 0,
        discountAmount: Number(discountAmount) || 0,
        discountRate: Number(discountRate) || 0,
        discountMode: discountMode === "amount" ? "amount" : "rate",
        total: Number(total) || 0,
        loan_enabled: !!loan_enabled,
        loan_meta: loan_meta ?? null,
        items: items ?? [],
        is_solar_sketch: true,
        bypass_token: generateRandomString(),
        green_sketch: this.normalizeSketch(green_sketch) ?? null,
        ...pricingPatch,
      };

      const quote = await quoteRepository.create(payload);
      try {
        await paymentHistoryRepository.create({ quote_id: quote.id });
        await quoteWorkflowRepository.create({
          quote_id: quote.id,
          sales_person_id: adminData.id,
          customer_id: customerId,
          installer_payment_status: PaymentStatus.PENDING,
          sales_person_payment_status: PaymentStatus.PENDING,
        });
      } catch (workflowErr) {
        console.error("Solar quote workflow bootstrap failed:", workflowErr);
      }
      const populated = await quoteRepository.findOne(
        { id: quote.id },
        { populate: quoteListPopulate, lean: true },
      );
      if (send_email === true || send_email === "true") {
        (async () => {
          try {
            await sendMasterQuoteEmail({
              quote_id: String(quote.id),
              type: QuoteEmailType.CREATED,
            });
          } catch (err: any) {
            console.error("Solar quote email failed:", err?.message);
          }
        })();
      }
      return ReS(res, SUCCESS_CODE, "Solar quote created", populated);
    } catch (error: any) {
      console.error("Error in createSolarQuote:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  /**
   * Public Share Proposal — no JWT.
   * Both MongoDB `_id` and sequential numeric `id` must match a solar sketch quote.
   */
  async getSolarProposal(req: AuthenticatedRequest, res: Response) {
    try {
      const objectId = String(Array.isArray(req.params.objectId) ? req.params.objectId[0] : req.params.objectId || "");
      const quoteIdRaw = Array.isArray(req.params.quoteId) ? req.params.quoteId[0] : req.params.quoteId;
      const numericId = Number(quoteIdRaw);

      if (!objectId || !mongoose.Types.ObjectId.isValid(objectId)) {
        return ReE(res, BAD_REQUEST_CODE, "Valid MongoDB object id is required");
      }
      if (!numericId || Number.isNaN(numericId)) {
        return ReE(res, BAD_REQUEST_CODE, "Valid numeric quote id is required");
      }

      const quote: any = await quoteRepository.findOne(
        {
          _id: new mongoose.Types.ObjectId(objectId),
          id: numericId,
          is_solar_sketch: true,
        },
        { populate: quoteDetailPopulate, lean: true },
      );

      if (!quote) {
        return ReE(res, RESOURCE_NOT_FOUND, "Solar proposal not found");
      }

      // Public payload — include what the share page needs, keep sender internals light.
      return ReS(res, SUCCESS_CODE, "Solar proposal fetched", {
        _id: String(quote._id),
        id: quote.id,
        name: quote.name,
        address: quote.address,
        mobile_no: quote.mobile_no,
        notes: quote.notes,
        currency: quote.currency,
        dateOfDue: quote.dateOfDue,
        subTotal: quote.subTotal,
        taxRate: quote.taxRate,
        taxAmount: quote.taxAmount,
        discountRate: quote.discountRate,
        discountAmount: quote.discountAmount,
        total: quote.total,
        rebateAmount: quote.rebateAmount,
        items: quote.items || [],
        loan_enabled: quote.loan_enabled,
        loan_meta: quote.loan_meta,
        green_sketch: quote.green_sketch,
        customer_accepted: quote.customer_accepted,
        customerSignatureUrl: quote.customerSignatureUrl,
        accepted_date: quote.accepted_date,
        signed_date: quote.signed_date,
        reason: quote.reason,
        bypass_token: quote.bypass_token,
        customer: quote.customer
          ? {
              id: quote.customer.id,
              name: quote.customer.name,
              email: quote.customer.email,
              mobile_no: quote.customer.mobile_no,
              address: quote.customer.address,
            }
          : null,
        installationType: quote.installationType,
        created_at: quote.created_at,
        updated_at: quote.updated_at,
      });
    } catch (error: any) {
      console.error("Error in getSolarProposal:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  /** Send quotation email for an existing Solar Sketch quote. */
  async sendSolarQuoteEmail(req: AuthenticatedRequest, res: Response) {
    try {
      const { quoteId, cc = [], bcc = [], type = QuoteEmailType.CREATED } = req.body;
      if (!quoteId) return ReE(res, BAD_REQUEST_CODE, "quoteId is required");

      const existing: any = await quoteRepository.findOne(
        { id: Number(quoteId), is_solar_sketch: true },
        { populate: { path: "customer", select: "id name email" }, lean: true },
      );
      if (!existing) return ReE(res, RESOURCE_NOT_FOUND, "Solar quote not found");

      await sendMasterQuoteEmail({
        quote_id: String(existing.id),
        type: type === QuoteEmailType.UPDATED ? QuoteEmailType.UPDATED : QuoteEmailType.CREATED,
        cc,
        bcc,
      });
      return ReS(res, SUCCESS_CODE, `Quotation email sent to ${existing?.customer?.email || "customer"}.`);
    } catch (error: any) {
      console.error("Error in sendSolarQuoteEmail:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  /** Paginated list of standalone Solar Sketch solar quotes. */
  async getSolarQuotes(req: AuthenticatedRequest, res: Response) {
    try {
      const { user } = req;
      const {
        limit = 12,
        page = 1,
        cust_name = null,
        order_by = "updated_at",
        order_direction = "DESC",
      } = req.body;
      const parsedLimit = parseInt(limit as string, 10);
      const parsedPage = parseInt(page as string, 10);

      const filter: Record<string, unknown> = { is_solar_sketch: true };
      if (!(await isQuoteAdmin(user))) {
        if (user.id !== 299) filter.$or = [{ sender_id: user.id }, { customer_id: user.id }];
      }
      if (cust_name) {
        const customers: any[] = await userRepository.find(
          { name: { $regex: cust_name, $options: "i" } },
          { select: "id", lean: true },
        );
        filter.customer_id = { $in: (customers || []).map((c) => c.id) };
      }

      const sortDir = order_direction === "ASC" ? 1 : -1;
      const { count, rows: quotes } = await quoteRepository.findPaginated(filter, {
        page: parsedPage,
        limit: parsedLimit,
        sort: { [order_by]: sortDir } as Record<string, 1 | -1>,
        populate: quoteListPopulate,
        lean: true,
      });

      return ReS(res, SUCCESS_CODE, "Solar quotes fetched successfully", {
        currentPage: parsedPage,
        totalPages: Math.ceil(count / parsedLimit),
        limit: parsedLimit,
        totalQuotes: count,
        data: quotes,
      });
    } catch (error: any) {
      console.error("Error in getSolarQuotes:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async sendQuoteFollowUp(req: AuthenticatedRequest, res: Response) {
    try {
      const { quoteId, cc = [], bcc = [] } = req.body;
      console.log(req.body);

      if (!quoteId)
        return ReE(res, BAD_REQUEST_CODE, "quoteId is required");

      const existing: any = await quoteRepository.findOne(
        { id: quoteId },
        {
          populate: { path: "customer", select: "id name email" },
          lean: true,
        },
      );

      if (!existing) {
        return ReE(res, FORBIDDEN_CODE, "Quote not found.");
      }
      await sendMasterQuoteEmail({
        quote_id: existing.id,
        type: QuoteEmailType.FOLLOW_UP,
        cc, bcc
      });
      const followUp = {
        last_follow_up_date_time: new Date(),
        follow_up_count: (existing.follow_up_count || 0) + 1,
        follow_up_history: [
          ...(existing.follow_up_history || []),
          {
            sender: req.user.name,
            senderId: req.user.id,
            date: new Date(),
          }
        ]
      };
      await quoteRepository.updateMany({ id: quoteId }, { $set: { ...followUp } });
      return ReS(res, SUCCESS_CODE, "Follow-up email sent successfully.");
    } catch (error: any) {
      console.error("sendQuoteFollowUp Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }
  async sendReviewAndFeedback(req: AuthenticatedRequest, res: Response) {
    try {
      const { quoteId, cc, bcc } = req.body;

      if (!quoteId)
        return ReE(res, BAD_REQUEST_CODE, "quoteId is required");

      const existing: any = await quoteRepository.findOne(
        { id: quoteId },
        {
          populate: { path: "customer", select: "id name email" },
          lean: true,
        },
      );

      if (!existing) {
        return ReE(res, FORBIDDEN_CODE, "Quote not found.");
      }
      await sendMasterQuoteEmail({
        quote_id: existing.id,
        type: QuoteEmailType.FEEDBACK,
        cc, bcc
      });
      return ReS(res, SUCCESS_CODE, `Review and Feedback email to ${existing?.customer?.email} sent successfully.`);
    } catch (error: any) {
      console.error("sendQuoteFollowUp Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }
  async sendCloseAlert(req: AuthenticatedRequest, res: Response) {
    try {
      const { quoteId, cc, bcc } = req.body;

      if (!quoteId)
        return ReE(res, BAD_REQUEST_CODE, "quoteId is required");

      const existing: any = await quoteRepository.findOne(
        { id: quoteId },
        {
          populate: { path: "customer", select: "id name email" },
          lean: true,
        },
      );
      if (!existing) {
        return ReE(res, FORBIDDEN_CODE, "Quote not found.");
      }
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);
      await quoteRepository.updateMany({ id: quoteId }, { $set: { quote_close_date: dueDate } });
      await sendMasterQuoteEmail({
        quote_id: existing.id,
        type: QuoteEmailType.CLOSED,
        cc, bcc
      });
      return ReS(res, SUCCESS_CODE, `Close quote email to ${existing?.customer?.email} sent successfully.`);
    } catch (error: any) {
      console.error("sendCloseAlert Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }
  async getSignedUrl(req: AuthenticatedRequest, res: Response) {
    try {
      const { url } = req.query;
      if (!url) return ReE(res, BAD_REQUEST_CODE, "URL is required");
      const signedUrl = await s3Service.signedUrl(url as string);
      if (!signedUrl) return ReE(res, SERVER_ERROR_CODE, "Failed to generate signed URL");
      return ReS(res, SUCCESS_CODE, "Signed URL generated successfully", { signedUrl });
    } catch (error: any) {
      console.error("Error in getSignedUrl:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }
  async getUniqueCustomersQuoteHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const { page = 1, limit = 10, order_by = 'total_quotes', order_direction = 'DESC', cust_name = null, cust_email = null } = req.body;
      const parsedLimit = parseInt(limit as string, 10);
      const parsedPage = parseInt(page as string, 10);
      // Prepare customer filter
      let customerIds: number[] | null = null;

      if (cust_name || cust_email) {
        const userFilter: Record<string, unknown>[] = [];
        if (cust_name) userFilter.push({ name: { $regex: cust_name, $options: "i" } });
        if (cust_email) userFilter.push({ email: { $regex: cust_email, $options: "i" } });
        const customers: any[] = await userRepository.find(
          { $or: userFilter },
          { select: "id", lean: true },
        );

        if (!customers || customers.length === 0) {
          return ReE(res, SERVER_ERROR_CODE, "Customer not found");
        }

        customerIds = customers.map((c) => c.id);
      }
      const matchStage: Record<string, unknown> = { deleted_at: null, is_solar_sketch: { $ne: true } };
      if (customerIds) matchStage.customer_id = { $in: customerIds };

      const sortDir = order_direction === "ASC" ? 1 : -1;
      const pipeline: any[] = [
        { $match: matchStage },
        {
          $group: {
            _id: "$customer_id",
            total_quotes: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "id",
            as: "customer",
          },
        },
        { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            customer_id: "$_id",
            total_quotes: 1,
            customer: {
              id: "$customer.id",
              name: "$customer.name",
              email: "$customer.email",
              mobile_no: "$customer.mobile_no",
              address: "$customer.address",
            },
          },
        },
        { $sort: { [order_by]: sortDir } },
        {
          $facet: {
            data: [{ $skip: (parsedPage - 1) * parsedLimit }, { $limit: parsedLimit }],
            total: [{ $count: "count" }],
          },
        },
      ];

      const [aggResult] = await quoteRepository.aggregateRaw(pipeline);
      const quotes = aggResult?.data || [];
      const total = aggResult?.total?.[0]?.count || 0;

      ReS(res, SUCCESS_CODE, "Unique customers with quote history fetched successfully", {
        data: quotes,
        total,
        page: parsedPage,
        limit: parsedLimit,
      });
    } catch (error) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }
  async getKanbanQuotes(req: AuthenticatedRequest, res: Response) {
    try {
      const { user } = req;
      const {
        limit = 10,
        page = 1,
        cust_name = null,
        cust_email = null,
        start_date,
        end_date,
        order_by = "updated_at",
        order_direction = "DESC",
        kanban_status = null,
        pipeline_status = null,
      } = req.body;

      const parsedLimit = parseInt(limit as string, 10);
      const parsedPage = parseInt(page as string, 10);

      // Prepare customer filter
      let customerIds: number[] | null = null;

      if (cust_name || cust_email) {
        const userFilter: Record<string, unknown>[] = [];
        if (cust_name) userFilter.push({ name: { $regex: cust_name, $options: "i" } });
        if (cust_email) userFilter.push({ email: { $regex: cust_email, $options: "i" } });
        const customers: any[] = await userRepository.find(
          { $or: userFilter },
          { select: "id", lean: true },
        );

        if (!customers || customers.length === 0) {
          return ReE(res, SERVER_ERROR_CODE, "Customer not found");
        }

        customerIds = customers.map((c) => c.id);
      }

      const filter: Record<string, unknown> = { is_solar_sketch: { $ne: true } };
    if (!(await isQuoteAdmin(user)))  {
         
          filter.$or = [{ sender_id: user.id }, { customer_id: user.id }];
      }
      if (customerIds) filter.customer_id = { $in: customerIds };
      const pipelineFilter = pipelineStatusFilter(pipeline_status || kanban_status);
      if (pipelineFilter) filter.kanban_status = pipelineFilter;
      // Do not force customer_accepted=ACCEPTED — pipeline columns include draft/pending/declined etc.
      if (start_date && end_date) {
        filter.updated_at = {
          $gte: new Date(start_date),
          $lte: new Date(end_date),
        };
      }

      const sortDir = order_direction === "ASC" ? 1 : -1;
      const { count, rows: quotes } = await quoteRepository.findPaginated(filter, {
        page: parsedPage,
        limit: parsedLimit,
        sort: { [order_by]: sortDir } as Record<string, 1 | -1>,
        populate: [
          { path: "customer", select: "id name email mobile_no address" },
          { path: "sender", select: "id name email mobile_no" },
        ],
        lean: true,
      });


      return ReS(res, SUCCESS_CODE, "Quotes fetched successfully", {
        currentPage: parsedPage,
        totalPages: Math.ceil(count / parsedLimit),
        limit: parsedLimit,
        totalQuotes: count,
        data: quotes,
      });
    } catch (error: any) {
      console.error("Error in getKanbanQuotes:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }
  async updateKanbanMovement(req: AuthenticatedRequest, res: Response) {
    try {
      const { taskId, from, to } = req.body;
      if (from == to) return ReE(res, FORBIDDEN_CODE, "from and to both are must not equal");
      if (!taskId || !to) return ReE(res, BAD_REQUEST_CODE, "TaskId and to Can't Be Null or undefined");
      const target = normalizePipelineStatus(to);
      if (!target) return ReE(res, BAD_REQUEST_CODE, "Invalid pipeline status");
      const result = await advanceQuotePipeline(Number(taskId), target, {
        reason: "kanban_move",
        actorId: req.user?.id,
        force: true,
      });
      if (result.updated) return ReS(res, SUCCESS_CODE, "Quote Updated SuccessFully");
      ReS(res, SUCCESS_CODE, "Quote not updated");
    } catch (error) {
      console.error("Error in updateKanbanMovement:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }
  async updateInstallStatus(req: AuthenticatedRequest, res: Response){
     try {
      const { id, status, notes, status_date, pipeline_status_date, stage_details } = req.body;
      if (!id || !status) return ReE(res, BAD_REQUEST_CODE, "Id and status Can't Be Null or undefined");
      const target = normalizePipelineStatus(status);
      if (!target) return ReE(res, BAD_REQUEST_CODE, "Invalid install/pipeline status");

      const trimmedNotes = notes != null ? String(notes).trim() : "";
      if (!trimmedNotes) {
        return ReE(res, BAD_REQUEST_CODE, "Notes are required for pipeline status updates");
      }
      const eventDate = status_date || pipeline_status_date;
      if (!eventDate) {
        return ReE(res, BAD_REQUEST_CODE, "Status date is required for pipeline status updates");
      }
      const parsedDate = new Date(eventDate);
      if (Number.isNaN(parsedDate.getTime())) {
        return ReE(res, BAD_REQUEST_CODE, "Invalid status date");
      }

      const result = await advanceQuotePipeline(Number(id), target, {
        reason: "install_status_update",
        actorId: req.user?.id,
        force: true,
        notes: trimmedNotes,
        statusDate: parsedDate,
      });

      if (stage_details && typeof stage_details === "object") {
        const quote: any = await quoteRepository.findOne({ id: Number(id) }, { lean: true });
        const existing =
          quote?.pipeline_stage_details && typeof quote.pipeline_stage_details === "object"
            ? { ...quote.pipeline_stage_details }
            : {};
        existing[target] = {
          ...stage_details,
          updated_at: new Date(),
          updated_by: req.user?.id ?? null,
        };
        await quoteRepository.updateMany(
          { id: Number(id) },
          { $set: { pipeline_stage_details: existing } },
        );
        if (result.quote) {
          (result.quote as any).pipeline_stage_details = existing;
        }
      }

      if (result.updated) return ReS(res, SUCCESS_CODE, "Quote Updated SuccessFully", result.quote);
      ReS(res, SUCCESS_CODE, "Quote not updated", result.quote);
    } catch (error) {
      console.error("Error in updateInstallStatus:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  /**
   * Manual "Stock Ordered" flow (NOT Stock Order module):
   * fill delivery details → pipeline STOCK_ORDERED → email customer.
   */
  async markStockOrdered(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        id,
        order_date,
        products_summary,
        expected_delivery_date,
        expected_delivery_time,
        delivery_address,
        driver_name,
        driver_phone,
        vehicle_number,
        tracking_number,
        notes,
        send_email = true,
      } = req.body;

      if (!id) return ReE(res, BAD_REQUEST_CODE, "Quote id is required");
      if (!order_date) return ReE(res, BAD_REQUEST_CODE, "Order date is required");
      if (!expected_delivery_date) {
        return ReE(res, BAD_REQUEST_CODE, "Expected delivery date is required");
      }
      if (!String(expected_delivery_time || "").trim()) {
        return ReE(res, BAD_REQUEST_CODE, "Expected delivery time is required");
      }
      if (!String(delivery_address || "").trim()) {
        return ReE(res, BAD_REQUEST_CODE, "Delivery address is required");
      }
      if (!String(driver_name || "").trim()) {
        return ReE(res, BAD_REQUEST_CODE, "Driver name is required");
      }
      if (!String(driver_phone || "").trim()) {
        return ReE(res, BAD_REQUEST_CODE, "Driver contact is required");
      }

      const parsedOrderDate = new Date(order_date);
      const parsedDeliveryDate = new Date(expected_delivery_date);
      if (Number.isNaN(parsedOrderDate.getTime())) {
        return ReE(res, BAD_REQUEST_CODE, "Invalid order date");
      }
      if (Number.isNaN(parsedDeliveryDate.getTime())) {
        return ReE(res, BAD_REQUEST_CODE, "Invalid delivery date");
      }

      const quote: any = await quoteRepository.findOne(
        { id: Number(id) },
        {
          populate: { path: "customer", select: "id name email address mobile_no" },
          lean: true,
        },
      );
      if (!quote) return ReE(res, RESOURCE_NOT_FOUND, "Quote not found");

      const items = Array.isArray(quote.items) ? quote.items : [];
      const productsText = String(products_summary || "").trim();
      const productListHtml = productsText
        ? productsText
            .split(/\n+/)
            .map((line: string) => line.trim())
            .filter(Boolean)
            .map((line: string) => `<div>${line}</div>`)
            .join("") || `<div>${productsText}</div>`
        : buildProductListHtml(items);

      const stageDetails = {
        mode: "manual",
        order_date: parsedOrderDate,
        products_summary: productsText,
        expected_delivery_date: parsedDeliveryDate,
        expected_delivery_time: String(expected_delivery_time).trim(),
        delivery_address: String(delivery_address).trim(),
        driver_name: String(driver_name).trim(),
        driver_phone: String(driver_phone).trim(),
        vehicle_number: String(vehicle_number || "").trim(),
        tracking_number: String(tracking_number || "").trim(),
        notes: String(notes || "").trim(),
        status_date: parsedOrderDate,
        updated_at: new Date(),
        updated_by: req.user?.id ?? null,
        email_sent: false,
      };

      const noteText =
        String(notes || "").trim() ||
        `Stock ordered — delivery ${formatAuDate(parsedDeliveryDate)} at ${stageDetails.expected_delivery_time} — ${stageDetails.driver_name}`;

      const existingDetails =
        quote?.pipeline_stage_details && typeof quote.pipeline_stage_details === "object"
          ? { ...quote.pipeline_stage_details }
          : {};
      existingDetails[QuotePipelineStatus.STOCK_ORDERED] = stageDetails;

      await quoteRepository.updateMany(
        { id: Number(id) },
        { $set: { pipeline_stage_details: existingDetails } },
      );

      const result = await advanceQuotePipeline(Number(id), QuotePipelineStatus.STOCK_ORDERED, {
        reason: "stock_ordered_manual",
        actorId: req.user?.id,
        force: true,
        notes: noteText,
        statusDate: parsedOrderDate,
      });

      const customerEmail = quote.customer?.email || quote.custEmail;
      const customerName = quote.name || quote.customer?.name || quote.custName || "Customer";
      const shouldEmail = send_email === true || send_email === "true";
      let emailQueued = false;

      if (shouldEmail && customerEmail) {
        const cfg = await getCompanyConfig();
        const html = stockDeliveryScheduledTemplate(
          {
            customerName,
            orderNumber: quote.id,
            productListHtml,
            orderDate: formatAuDate(parsedOrderDate),
            deliveryDate: formatAuDate(parsedDeliveryDate),
            deliveryTime: stageDetails.expected_delivery_time,
            deliveryAddress: stageDetails.delivery_address,
            driverName: stageDetails.driver_name,
            driverPhone: stageDetails.driver_phone,
            vehicleNumber: stageDetails.vehicle_number || "—",
            trackingNumber: stageDetails.tracking_number || "—",
          },
          cfg,
        );
        await sendEmail(
          customerEmail,
          `Your Order Has Been Confirmed & Delivery Scheduled – ${cfg.name}`,
          html,
        ).catch((e: any) => console.error("Stock ordered customer email failed:", e?.message));
        emailQueued = true;
        existingDetails[QuotePipelineStatus.STOCK_ORDERED] = {
          ...stageDetails,
          email_sent: true,
          email_sent_at: new Date(),
        };
        await quoteRepository.updateMany(
          { id: Number(id) },
          { $set: { pipeline_stage_details: existingDetails } },
        );
      } else if (shouldEmail && !customerEmail) {
        console.warn(`markStockOrdered: no customer email for quote #${id}`);
      }

      await notificationController.createNotification({
        userId: req.user.id,
        message: `Stock ordered for Quote #${id} — delivery ${formatAuDate(parsedDeliveryDate)}.`,
        route: `${process.env.FRONT_URL}/#/quote/customer-view/${quote.id}/${quote.bypass_token}`,
        meta: {
          type: "QUOTE",
          customerId: quote.customer_id,
          customerName,
          senderName: req.user.name,
          role: req.user.role,
        },
      });

      const updatedQuote = await quoteRepository.findOne({ id: Number(id) }, { lean: true });
      return ReS(
        res,
        SUCCESS_CODE,
        emailQueued
          ? "Stock ordered and customer emailed"
          : "Stock ordered (no customer email sent)",
        {
          quote: updatedQuote || result.quote,
          stage_details: existingDetails[QuotePipelineStatus.STOCK_ORDERED],
        },
      );
    } catch (error: any) {
      console.error("Error in markStockOrdered:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  /**
   * Dedicated "Installation Scheduled" flow:
   * save install details → pipeline INSTALLATION_SCHEDULED → email customer.
   */
  async scheduleInstallation(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        id,
        installation_date,
        installation_time,
        estimated_duration,
        installation_address,
        installer_name,
        installer_company,
        installer_phone,
        installer_email,
        saa_number,
        electrical_licence,
        cec_number,
        inverter,
        panels,
        battery,
        ev_charger,
        notes,
      } = req.body;

      if (!id) return ReE(res, BAD_REQUEST_CODE, "Quote id is required");
      if (!installation_date) return ReE(res, BAD_REQUEST_CODE, "Installation date is required");
      if (!String(installation_time || "").trim()) {
        return ReE(res, BAD_REQUEST_CODE, "Installation time is required");
      }
      if (!String(installer_name || "").trim()) {
        return ReE(res, BAD_REQUEST_CODE, "Installer name is required");
      }
      if (!String(installer_phone || "").trim()) {
        return ReE(res, BAD_REQUEST_CODE, "Installer phone is required");
      }

      const parsedDate = new Date(installation_date);
      if (Number.isNaN(parsedDate.getTime())) {
        return ReE(res, BAD_REQUEST_CODE, "Invalid installation date");
      }

      const quote: any = await quoteRepository.findOne(
        { id: Number(id) },
        {
          populate: { path: "customer", select: "id name email address mobile_no" },
          lean: true,
        },
      );
      if (!quote) return ReE(res, RESOURCE_NOT_FOUND, "Quote not found");

      const items = Array.isArray(quote.items) ? quote.items : [];
      const schedule = {
        installation_date: parsedDate,
        installation_time: String(installation_time).trim(),
        estimated_duration: String(estimated_duration || "").trim() || "—",
        installation_address:
          String(installation_address || "").trim() || quote.address || quote.customer?.address || "",
        installer_name: String(installer_name).trim(),
        installer_company: String(installer_company || "").trim(),
        installer_phone: String(installer_phone).trim(),
        installer_email: String(installer_email || "").trim(),
        saa_number: String(saa_number || "").trim(),
        electrical_licence: String(electrical_licence || "").trim(),
        cec_number: String(cec_number || "").trim(),
        inverter: String(inverter || "").trim() || summarizeItems(items, ["inverter"]),
        panels: String(panels || "").trim() || summarizeItems(items, ["panel", "module"]),
        battery: String(battery || "").trim() || summarizeItems(items, ["battery", "bess"]),
        ev_charger: String(ev_charger || "").trim() || summarizeItems(items, ["ev", "charger"]),
        scheduled_at: new Date(),
        scheduled_by: req.user?.id ?? null,
      };

      const noteText =
        String(notes || "").trim() ||
        `Installation scheduled for ${formatAuDate(parsedDate)} at ${schedule.installation_time} — ${schedule.installer_name}`;

      await quoteRepository.updateMany(
        { id: Number(id) },
        { $set: { installation_schedule: schedule } },
      );

      const result = await advanceQuotePipeline(Number(id), QuotePipelineStatus.INSTALLATION_SCHEDULED, {
        reason: "installation_scheduled",
        actorId: req.user?.id,
        force: true,
        notes: noteText,
        statusDate: parsedDate,
      });

      const customerEmail = quote.customer?.email;
      const customerName = quote.name || quote.customer?.name || "Customer";

      if (customerEmail) {
        const cfg = await getCompanyConfig();
        const html = installationScheduledTemplate(
          {
            customerName,
            installationDate: formatAuDate(parsedDate),
            installationTime: schedule.installation_time,
            estimatedDuration: schedule.estimated_duration,
            installationAddress: schedule.installation_address || "—",
            installerName: schedule.installer_name,
            installerCompany: schedule.installer_company || "—",
            installerPhone: schedule.installer_phone,
            installerEmail: schedule.installer_email || "—",
            saaNumber: schedule.saa_number || "—",
            electricalLicence: schedule.electrical_licence || "—",
            cecNumber: schedule.cec_number || "—",
            productListHtml: buildProductListHtml(items),
            inverter: schedule.inverter,
            panels: schedule.panels,
            battery: schedule.battery,
            evCharger: schedule.ev_charger,
          },
          cfg,
        );
        await sendEmail(
          customerEmail,
          `Your Solar Installation Has Been Scheduled – ${cfg.name}`,
          html,
        ).catch((e: any) => console.error("Installation schedule email failed:", e?.message));
      } else {
        console.warn(`scheduleInstallation: no customer email for quote #${id}`);
      }

      await notificationController.createNotification({
        userId: req.user.id,
        message: `Installation scheduled for Quote #${id} on ${formatAuDate(parsedDate)}.`,
        route: `${process.env.FRONT_URL}/#/quote/customer-view/${quote.id}/${quote.bypass_token}`,
        meta: {
          type: "QUOTE",
          customerId: quote.customer_id,
          customerName,
          senderName: req.user.name,
          role: req.user.role,
        },
      });

      const updatedQuote = await quoteRepository.findOne({ id: Number(id) }, { lean: true });
      return ReS(res, SUCCESS_CODE, "Installation scheduled and customer emailed", {
        quote: updatedQuote || result.quote,
        installation_schedule: schedule,
      });
    } catch (error: any) {
      console.error("Error in scheduleInstallation:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  /**
   * Reschedule existing installation → update details → email customer with reason.
   */
  async rescheduleInstallation(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        id,
        installation_date,
        installation_time,
        estimated_duration,
        installation_address,
        installer_name,
        installer_company,
        installer_phone,
        installer_email,
        saa_number,
        electrical_licence,
        cec_number,
        reason,
        reason_other,
        notes,
      } = req.body;

      if (!id) return ReE(res, BAD_REQUEST_CODE, "Quote id is required");
      if (!installation_date) return ReE(res, BAD_REQUEST_CODE, "New installation date is required");
      if (!String(installation_time || "").trim()) {
        return ReE(res, BAD_REQUEST_CODE, "New installation time is required");
      }

      const reasonKey = String(reason || "").trim();
      if (!reasonKey) return ReE(res, BAD_REQUEST_CODE, "Reason for reschedule is required");

      const reasonLabel =
        reasonKey === "Other"
          ? String(reason_other || "").trim() || "Other"
          : reasonKey;

      if (reasonKey === "Other" && !String(reason_other || "").trim()) {
        return ReE(res, BAD_REQUEST_CODE, "Please enter the reason when selecting Other");
      }

      const parsedDate = new Date(installation_date);
      if (Number.isNaN(parsedDate.getTime())) {
        return ReE(res, BAD_REQUEST_CODE, "Invalid installation date");
      }

      const quote: any = await quoteRepository.findOne(
        { id: Number(id) },
        {
          populate: { path: "customer", select: "id name email address mobile_no" },
          lean: true,
        },
      );
      if (!quote) return ReE(res, RESOURCE_NOT_FOUND, "Quote not found");

      const previous = quote.installation_schedule || {};
      const previousDate = previous.installation_date || quote.pipeline_status_date || null;

      const history = Array.isArray(previous.reschedule_history) ? [...previous.reschedule_history] : [];
      history.push({
        from_date: previousDate || null,
        from_time: previous.installation_time || null,
        to_date: parsedDate,
        to_time: String(installation_time).trim(),
        reason: reasonLabel,
        at: new Date(),
        by: req.user?.id ?? null,
      });

      const schedule = {
        ...previous,
        installation_date: parsedDate,
        installation_time: String(installation_time).trim(),
        estimated_duration:
          String(estimated_duration || "").trim() || previous.estimated_duration || "—",
        installation_address:
          String(installation_address || "").trim() ||
          previous.installation_address ||
          quote.address ||
          quote.customer?.address ||
          "",
        installer_name: String(installer_name || previous.installer_name || "").trim(),
        installer_company: String(installer_company || previous.installer_company || "").trim(),
        installer_phone: String(installer_phone || previous.installer_phone || "").trim(),
        installer_email: String(installer_email || previous.installer_email || "").trim(),
        saa_number: String(saa_number || previous.saa_number || "").trim(),
        electrical_licence: String(electrical_licence || previous.electrical_licence || "").trim(),
        cec_number: String(cec_number || previous.cec_number || "").trim(),
        last_reschedule_reason: reasonLabel,
        rescheduled_at: new Date(),
        rescheduled_by: req.user?.id ?? null,
        reschedule_history: history,
      };

      if (!schedule.installer_name) {
        return ReE(res, BAD_REQUEST_CODE, "Installer name is required");
      }
      if (!schedule.installer_phone) {
        return ReE(res, BAD_REQUEST_CODE, "Installer phone is required");
      }

      const noteText =
        String(notes || "").trim() ||
        `Installation rescheduled to ${formatAuDate(parsedDate)} at ${schedule.installation_time}. Reason: ${reasonLabel}`;

      await quoteRepository.updateMany(
        { id: Number(id) },
        { $set: { installation_schedule: schedule } },
      );

      const result = await advanceQuotePipeline(Number(id), QuotePipelineStatus.INSTALLATION_SCHEDULED, {
        reason: "installation_rescheduled",
        actorId: req.user?.id,
        force: true,
        notes: noteText,
        statusDate: parsedDate,
      });

      const customerEmail = quote.customer?.email;
      const customerName = quote.name || quote.customer?.name || "Customer";

      if (customerEmail) {
        const cfg = await getCompanyConfig();
        const html = installationRescheduledTemplate(
          {
            customerName,
            reason: reasonLabel,
            previousInstallationDate: formatAuDate(previousDate),
            newInstallationDate: formatAuDate(parsedDate),
            newInstallationTime: schedule.installation_time,
            estimatedDuration: schedule.estimated_duration,
            installationAddress: schedule.installation_address || "—",
            installerName: schedule.installer_name,
            installerCompany: schedule.installer_company || "—",
            installerPhone: schedule.installer_phone,
            saaNumber: schedule.saa_number || "—",
            electricalLicence: schedule.electrical_licence || "—",
          },
          cfg,
        );
        await sendEmail(
          customerEmail,
          `Your Installation Schedule Has Been Updated – ${cfg.name}`,
          html,
        ).catch((e: any) => console.error("Installation reschedule email failed:", e?.message));
      } else {
        console.warn(`rescheduleInstallation: no customer email for quote #${id}`);
      }

      await notificationController.createNotification({
        userId: req.user.id,
        message: `Installation rescheduled for Quote #${id} to ${formatAuDate(parsedDate)}.`,
        route: `${process.env.FRONT_URL}/#/quote/customer-view/${quote.id}/${quote.bypass_token}`,
        meta: {
          type: "QUOTE",
          customerId: quote.customer_id,
          customerName,
          senderName: req.user.name,
          role: req.user.role,
        },
      });

      const updatedQuote = await quoteRepository.findOne({ id: Number(id) }, { lean: true });
      return ReS(res, SUCCESS_CODE, "Installation rescheduled and customer emailed", {
        quote: updatedQuote || result.quote,
        installation_schedule: schedule,
      });
    } catch (error: any) {
      console.error("Error in rescheduleInstallation:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async markDeadQuotesCron() {
    try {
      console.log("🔄 markDeadQuotesCron started");

      const quotes: any = await quoteRepository.find({
        quote_close_date: { $lte: new Date() },
        customer_accepted: {
          $in: [
            QuoteCustomerStatus.PENDING,
            QuoteCustomerStatus.REJECTED,
            QuoteCustomerStatus.EXPIRED
          ]
        }
      }, { select: "id", lean: true });

      if (!quotes.length) {
        console.log("✔ No quotes to mark as DEAD");
        return;
      }

      const ids = quotes.map((q: any) => q.id);

      const updateResult = await quoteRepository.updateMany(
        { id: { $in: ids } },
        { $set: { customer_accepted: QuoteCustomerStatus.DEAD, status_updated_date: new Date() } },
      );

      for (const id of ids) {
        await advanceQuotePipeline(Number(id), QuotePipelineStatus.DECLINED_CANCELLED, {
          reason: "cron_mark_dead",
          force: true,
        });
      }

      console.log(`⚡ Updated ${updateResult.modifiedCount} quotes → DEAD`);

    } catch (err) {
      console.error("❌ markDeadQuotesCron error:", err);
    }
  }
  async quoteSenderNames(req: AuthenticatedRequest, res: Response) {
    try {
      const { search = "", limit = 10, page = 1 } = req.query as any;
      const parsedLimit = Number(limit);
      const parsedPage = Number(page);
      const offset = (parsedPage - 1) * parsedLimit;

      const matchStage: Record<string, unknown> = { deleted_at: null };

      if (search) {
        const users = await userRepository.find(
          { name: { $regex: search, $options: "i" } },
          { select: "id", lean: true },
        );

        if (users.length === 0) {
          return ReS(res, NO_CONTENT, "Success", {
            currentPage: parsedPage,
            totalPages: 0,
            limit: parsedLimit,
            totalItems: 0,
            data: []
          });
        }

        matchStage.sender_id = { $in: users.map((u: any) => u.id) };
      }

      const pipeline: any[] = [
        { $match: matchStage },
        {
          $group: {
            _id: "$sender_id",
            quoteCount: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "id",
            as: "sender",
          },
        },
        { $unwind: { path: "$sender", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            sender_id: "$_id",
            quoteCount: 1,
            sender: { id: "$sender.id", name: "$sender.name", email: "$sender.email" },
          },
        },
        {
          $facet: {
            data: [{ $skip: offset }, { $limit: parsedLimit }],
            total: [{ $count: "count" }],
          },
        },
      ];

      const [aggResult] = await quoteRepository.aggregateRaw(pipeline);
      const rows = aggResult?.data || [];
      const totalItems = aggResult?.total?.[0]?.count || 0;
      const totalPages = Math.ceil(totalItems / parsedLimit);

      return ReS(res, SUCCESS_CODE, "Success", {
        currentPage: parsedPage,
        totalPages,
        limit: parsedLimit,
        totalItems,
        data: rows
      });

    } catch (e) {
      return ReE(res, SERVER_ERROR_CODE, e);
    }
  }

  /** Counts per pipeline status for CRM filter chips. */
  async getPipelineCounts(req: AuthenticatedRequest, res: Response) {
    try {
      const { user } = req;
      const {
        sender_name = "",
        cust_name = null,
        cust_email = null,
        start_date,
        end_date,
        year = null,
        quote_type = "all",
      } = req.body || {};

      const filter: Record<string, unknown> = {};
      const normalizedQuoteType = String(quote_type || "all").toLowerCase();
      if (normalizedQuoteType === "solar_sketch" || normalizedQuoteType === "solar") {
        filter.is_solar_sketch = true;
      } else if (normalizedQuoteType === "normal") {
        filter.is_solar_sketch = { $ne: true };
      }
      if (!(await isQuoteAdmin(user))) {
        if (user.id !== 299) filter.$or = [{ sender_id: user.id }, { customer_id: user.id }];
      }

      if (cust_name || cust_email) {
        const userFilter: Record<string, unknown>[] = [];
        if (cust_name) userFilter.push({ name: { $regex: cust_name, $options: "i" } });
        if (cust_email) userFilter.push({ email: { $regex: cust_email, $options: "i" } });
        const customers: any[] = await userRepository.find({ $or: userFilter }, { select: "id", lean: true });
        if (!customers.length) {
          const empty: Record<string, number> = { ALL: 0 };
          for (const s of ALL_PIPELINE_STATUSES) empty[s] = 0;
          return ReS(res, SUCCESS_CODE, "Pipeline counts", empty);
        }
        filter.customer_id = { $in: customers.map((c) => c.id) };
      }

      if (sender_name) {
        const senders: any[] = await userRepository.find(
          { name: { $regex: sender_name, $options: "i" } },
          { select: "id", lean: true },
        );
        if (!senders.length) {
          const empty: Record<string, number> = { ALL: 0 };
          for (const s of ALL_PIPELINE_STATUSES) empty[s] = 0;
          return ReS(res, SUCCESS_CODE, "Pipeline counts", empty);
        }
        filter.sender_id = { $in: senders.map((s) => s.id) };
      }

      if (start_date && end_date) {
        filter.created_at = { $gte: new Date(start_date), $lte: new Date(end_date) };
      }
      if (year) {
        const yearNumber = Number(year);
        if (!isNaN(yearNumber)) {
          filter.created_at = {
            ...(filter.created_at as object || {}),
            $gte: new Date(yearNumber, 0, 1),
            $lt: new Date(yearNumber + 1, 0, 1),
          };
        }
      }

      const rows = await quoteRepository.aggregateRaw([
        { $match: { ...filter, deleted_at: null } },
        { $group: { _id: "$kanban_status", count: { $sum: 1 } } },
      ]);

      const counts: Record<string, number> = { ALL: 0 };
      for (const s of ALL_PIPELINE_STATUSES) counts[s] = 0;

      for (const row of rows || []) {
        const raw = row._id || QuotePipelineStatus.PENDING;
        const normalized = normalizePipelineStatus(raw) || raw;
        const n = Number(row.count) || 0;
        counts.ALL += n;
        if (counts[normalized] != null) counts[normalized] += n;
        else counts[normalized] = n;
      }

      return ReS(res, SUCCESS_CODE, "Pipeline counts", counts);
    } catch (error: any) {
      console.error("getPipelineCounts Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  /** Explicitly close a job → JOB_CLOSED. */
  async closeQuoteJob(req: AuthenticatedRequest, res: Response) {
    try {
      const { quoteId, id } = req.body;
      const qid = Number(quoteId || id);
      if (!qid) return ReE(res, BAD_REQUEST_CODE, "quoteId is required");
      const existing = await quoteRepository.findOne({ id: qid }, { lean: true });
      if (!existing) return ReE(res, RESOURCE_NOT_FOUND, "Quote not found");
      const result = await advanceQuotePipeline(qid, QuotePipelineStatus.JOB_CLOSED, {
        reason: "job_closed",
        actorId: req.user?.id,
        force: true,
      });
      return ReS(res, SUCCESS_CODE, "Job closed", result);
    } catch (error: any) {
      console.error("closeQuoteJob Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  /**
   * Cancel project → DECLINED_CANCELLED + customer cancellation email.
   * User mainly selects cancellation reason; CRM auto-fills quote/job/customer.
   */
  async cancelProject(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        id,
        cancellation_reason,
        reason_other,
        cancellation_date,
        deposit_amount,
        refund_status,
        refund_date,
        notes,
      } = req.body;

      if (!id) return ReE(res, BAD_REQUEST_CODE, "Quote id is required");

      const reasonKey = String(cancellation_reason || "").trim();
      if (!reasonKey) return ReE(res, BAD_REQUEST_CODE, "Cancellation reason is required");

      const reasonLabel =
        reasonKey === "Other" ? String(reason_other || "").trim() || "Other" : reasonKey;

      if (reasonKey === "Other" && !String(reason_other || "").trim()) {
        return ReE(res, BAD_REQUEST_CODE, "Please enter the reason when selecting Other");
      }

      const cancelDate = cancellation_date ? new Date(cancellation_date) : new Date();
      if (Number.isNaN(cancelDate.getTime())) {
        return ReE(res, BAD_REQUEST_CODE, "Invalid cancellation date");
      }

      const quote: any = await quoteRepository.findOne(
        { id: Number(id) },
        {
          populate: { path: "customer", select: "id name email address mobile_no" },
          lean: true,
        },
      );
      if (!quote) return ReE(res, RESOURCE_NOT_FOUND, "Quote not found");

      const workflow: any = await quoteWorkflowRepository.findOne(
        { quote_id: Number(id) },
        { select: "id", lean: true },
      );

      const details = {
        quote_number: quote.id,
        job_number: workflow?.id ?? quote.id,
        cancellation_date: cancelDate,
        cancellation_reason: reasonLabel,
        deposit_amount: deposit_amount != null && deposit_amount !== "" ? String(deposit_amount) : "N/A",
        refund_status: String(refund_status || "Not Applicable").trim() || "Not Applicable",
        refund_date: refund_date ? new Date(refund_date) : null,
        cancelled_at: new Date(),
        cancelled_by: req.user?.id ?? null,
        notes: String(notes || "").trim(),
      };

      const noteText =
        String(notes || "").trim() || `Project cancelled. Reason: ${reasonLabel}`;

      await quoteRepository.updateMany(
        { id: Number(id) },
        {
          $set: {
            cancellation_details: details,
            customer_accepted: QuoteCustomerStatus.REJECTED,
            reason: reasonLabel,
          },
        },
      );

      const result = await advanceQuotePipeline(Number(id), QuotePipelineStatus.DECLINED_CANCELLED, {
        reason: "project_cancelled",
        actorId: req.user?.id,
        force: true,
        notes: noteText,
        statusDate: cancelDate,
      });

      const customerEmail = quote.customer?.email;
      const customerName = quote.name || quote.customer?.name || "Customer";

      if (customerEmail) {
        const cfg = await getCompanyConfig();
        const html = projectCancelledTemplate(
          {
            customerName,
            quoteNumber: details.quote_number,
            jobNumber: details.job_number,
            cancellationDate: formatAuDate(cancelDate),
            cancellationReason: reasonLabel,
            depositAmount: details.deposit_amount,
            refundStatus: details.refund_status,
            refundDate: details.refund_date ? formatAuDate(details.refund_date) : "—",
          },
          cfg,
        );
        await sendEmail(
          customerEmail,
          `Your Solar Project Has Been Cancelled – ${cfg.name}`,
          html,
        ).catch((e: any) => console.error("Project cancellation email failed:", e?.message));
      } else {
        console.warn(`cancelProject: no customer email for quote #${id}`);
      }

      await notificationController.createNotification({
        userId: req.user.id,
        message: `Quote #${id} cancelled — ${reasonLabel}`,
        route: `${process.env.FRONT_URL}/#/quote/customer-view/${quote.id}/${quote.bypass_token}`,
        meta: {
          type: "QUOTE",
          customerId: quote.customer_id,
          customerName,
          senderName: req.user.name,
          role: req.user.role,
        },
      });

      const updatedQuote = await quoteRepository.findOne({ id: Number(id) }, { lean: true });
      return ReS(res, SUCCESS_CODE, "Project cancelled and customer emailed", {
        quote: updatedQuote || result.quote,
        cancellation_details: details,
      });
    } catch (error: any) {
      console.error("Error in cancelProject:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

}

export default new QuotesController();
