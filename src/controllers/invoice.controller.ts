import { Response } from "express";
import {
  invoiceRepository,
  quoteRepository,
  userRepository,
} from "@repositories";
import { ReE, ReS } from "@services/generalHelper.service";
import { SERVER_ERROR_CODE, SUCCESS_CODE, FORBIDDEN_CODE, RESOURCE_NOT_FOUND, BAD_REQUEST_CODE } from "@constants/serverCode";
import { AuthenticatedRequest } from "@constants/common.interface";
import { PaymentStatus, QuoteCustomerStatus } from "@constants/common.enum";
import { EVENT_TASK_TYPE, SOCKET_EVENTS, USER_NOTIFICATION_EVENT_TYPE } from "@constants/socket.constants";
import { sendEventEmail } from "@services/email.service";
import { SocketService } from "@services/socket.service";
import notificationController from "./notification.controller";
import { Roles } from './../data/dataInserter';
import {
  applyInvoicePaymentChipFilter,
  computeInvoicePaymentChipCounts,
  emptyInvoicePaymentCounts,
  UPDATABLE_PAYMENT_STATUSES,
} from "@services/invoicePaymentChips.service";

const invoiceListPopulate = [
  {
    path: "quote",
    populate: [
      { path: "customer", select: "id name email" },
      { path: "cf", select: "name email address mobile postcode suburb" },
    ],
  },
  { path: "sender", select: "id name email" },
];

const invoiceDetailPopulate = [
  {
    path: "quote",
    populate: [
      { path: "customer", select: "id name email username address mobile_no" },
      { path: "cf", select: "name email address mobile postcode suburb" },
    ],
  },
  { path: "sender", select: "id name email" },
];

class InvoiceController {
  async createOrUpdateInvoice(req: AuthenticatedRequest, res: Response) {
    try {
      const { id: sender_id } = req.user;
      const { quote_id, pay_status, dateOfDue, address=null,name=null } = req.body;

      if (!quote_id || !sender_id) {
        return ReE(res, FORBIDDEN_CODE, "Missing required fields: quote_id or sender_id.");
      }

      const quote: any = await quoteRepository.findOne(
        { id: quote_id },
        {
          select: "bypass_token customer_accepted name mobile_no",
          populate: { path: "customer", select: "id name email" },
          lean: true,
        },
      );

      if (!quote)
        return ReE(res, RESOURCE_NOT_FOUND, "Quote not found for the provided quote_id and sender.");

      const CustName = name
                       ? name
                         : quote.name
                             ? quote.name
                                : quote.customer?.name;

      if (quote.customer_accepted !== QuoteCustomerStatus.ACCEPTED)
        return ReE(res, BAD_REQUEST_CODE, "Quote is not accepted by customer");

      const existingInvoice = await invoiceRepository.findOne({
        quote_id, sender_id,
      });

      if (existingInvoice)
        return ReS(res, SUCCESS_CODE, "Invoice already exists", existingInvoice);
      const invoice: any = await invoiceRepository.create({
        quote_id, sender_id,
        bypass_token: quote.bypass_token,
        pay_status, dateOfDue, address,
        name: CustName,
        mobile_no: quote.mobile_no,
        status_updated_date: new Date(),
      });
      const customerData = quote.customer;
      const emailPayload = {
        email: customerData.email,
        subject: "📄 Your Invoice Has Been Created",
        client_name: customerData.name,
        id: invoice.id,
        type: "INVOICE",
        title: `Invoice #${invoice.id}`,
        status: pay_status,
        due_date: dateOfDue,
        link: `${process.env.FRONT_URL}/#/invoice/customer-view/${invoice.id}/${quote.bypass_token}`,
        event: EVENT_TASK_TYPE.CREATED
      };
      ReS(res, SUCCESS_CODE, "Invoice created successfully", invoice);
      await notificationController.createNotification({
        userId: sender_id,
        message: `new Invoice created`,
        route:`${process.env.FRONT_URL}/#/invoice/customer-view/${invoice.id}/${quote.bypass_token}`,
        meta:{
          type: USER_NOTIFICATION_EVENT_TYPE.INVOICE,
          customerId: customerData.id,
          customerName: customerData.name,
          senderName: req.user.name,
          role: req.user.role
        }
      });
      SocketService.emit(SOCKET_EVENTS.USER_NOTIFICATION + `${sender_id}`, {
        type: USER_NOTIFICATION_EVENT_TYPE.INVOICE,
        name: req.user.name,
        profile_image: req.user.profile_image,
        task_type: EVENT_TASK_TYPE.CREATED,
        message: `new Invoice created`,
      })
      SocketService.emit(SOCKET_EVENTS.USER_NOTIFICATION + `${customerData.id}`, {
        type: USER_NOTIFICATION_EVENT_TYPE.INVOICE,
        name: req.user.name,
        profile_image: req.user.profile_image,
        task_type: EVENT_TASK_TYPE.CREATED,
        message: `new Invoice created`,
      })
      return sendEventEmail(emailPayload);
    } catch (error: any) {
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }


  async getInvoices(req: AuthenticatedRequest, res: Response) {
    try {
      const { page = 1, limit = 10, pay_status, customer_name, customer_email, start_date, end_date, } = req.body;

      const parsedLimit = parseInt(limit as string, 10);
      const parsedPage = parseInt(page as string, 10);

      const filter: Record<string, unknown> = {};

      if (pay_status) applyInvoicePaymentChipFilter(filter, pay_status, { supportDiscountFields: false });

      if (customer_name || customer_email) {
        const userFilter: Record<string, unknown> = {};
        if (customer_name) userFilter.name = { $regex: customer_name, $options: "i" };
        if (customer_email) userFilter.email = { $regex: customer_email, $options: "i" };
        const customers = await userRepository.find(userFilter, { select: "id", lean: true });
        if (!customers.length) {
          return ReS(res, SUCCESS_CODE, "Invoices fetched successfully", {
            currentPage: parsedPage,
            totalPages: 0,
            limit: parsedLimit,
            totalInvoices: 0,
            data: [],
          });
        }
        const quotes = await quoteRepository.find(
          { customer_id: { $in: customers.map((c: any) => c.id) } },
          { select: "id", lean: true },
        );
        filter.quote_id = { $in: quotes.map((q: any) => q.id) };
      }

      if (start_date && end_date) {
        filter.created_at = {
          $gte: new Date(start_date),
          $lte: new Date(end_date),
        };
      } else if (start_date) {
        filter.created_at = { $gte: new Date(start_date) };
      } else if (end_date) {
        filter.created_at = { $lte: new Date(end_date) };
      }

      const { count, rows: invoices } = await invoiceRepository.findPaginated(filter, {
        page: parsedPage,
        limit: parsedLimit,
        sort: { created_at: -1 },
        populate: invoiceListPopulate,
      });

      return ReS(res, SUCCESS_CODE, "Invoices fetched successfully", {
        currentPage: parsedPage,
        totalPages: Math.ceil(count / parsedLimit),
        limit: parsedLimit,
        totalInvoices: count,
        data: invoices ?? [],
      });
    } catch (error: any) {
      console.error("getInvoices Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }


  async getInvoiceById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id }:any = req.params;
      const bypass_token = req.bypass_token;

      const filter: Record<string, unknown> = { id: Number(id) };
      if (!id) return ReE(res, SERVER_ERROR_CODE, "Invoice ID is required");
      if (bypass_token) filter.bypass_token = bypass_token

      const invoice = await invoiceRepository.findOne(filter, {
        populate: invoiceDetailPopulate,
      });

      if (!invoice) return ReE(res, SERVER_ERROR_CODE, "Invoice not found");

      return ReS(res, SUCCESS_CODE, "Invoice fetched successfully", invoice);
    } catch (error: any) {
      console.error("getInvoiceById Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async deleteInvoice(req: AuthenticatedRequest, res: Response) {
    try {
      const { id }:any = req.params;

      if (!id) return ReE(res, SERVER_ERROR_CODE, "Invoice ID is required");
      const filter: Record<string, unknown> = { id: Number(id) };
      if(req.user.role !== Roles.SUPER_ADMIN)
          filter.sender_id = req.user.id
      const invoice = await invoiceRepository.findOne(filter);

      if (!invoice) return ReE(res, SERVER_ERROR_CODE, "Invoice not found or access denied");

      await invoiceRepository.deleteById(Number(id));
      await notificationController.createNotification({
        userId: req.user.id,
        message: `Invoice deleted ${id}`,
        route: null,
        meta:{
          type: USER_NOTIFICATION_EVENT_TYPE.INVOICE,
          senderName: req.user.name,
          role: req.user.role
        }
      });
      return ReS(res, SUCCESS_CODE, "Invoice deleted successfully");
    } catch (error: any) {
      console.error("deleteInvoice Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async getPaymentStatusCounts(req: AuthenticatedRequest, res: Response) {
    try {
      const { customer_name, customer_email, start_date, end_date } = req.body || {};
      const filter: Record<string, unknown> = {};

      if (customer_name || customer_email) {
        const userFilter: Record<string, unknown> = {};
        if (customer_name) userFilter.name = { $regex: customer_name, $options: "i" };
        if (customer_email) userFilter.email = { $regex: customer_email, $options: "i" };
        const customers = await userRepository.find(userFilter, { select: "id", lean: true });
        if (!customers.length) {
          return ReS(res, SUCCESS_CODE, "Payment status counts", emptyInvoicePaymentCounts());
        }
        const quotes = await quoteRepository.find(
          { customer_id: { $in: customers.map((c: any) => c.id) } },
          { select: "id", lean: true },
        );
        filter.quote_id = { $in: quotes.map((q: any) => q.id) };
      }

      if (start_date && end_date) {
        filter.created_at = { $gte: new Date(start_date), $lte: new Date(end_date) };
      } else if (start_date) {
        filter.created_at = { $gte: new Date(start_date) };
      } else if (end_date) {
        filter.created_at = { $lte: new Date(end_date) };
      }

      const rows: any[] = await invoiceRepository.find(
        { ...filter },
        { select: "pay_status dateOfDue", lean: true },
      );

      return ReS(res, SUCCESS_CODE, "Payment status counts", computeInvoicePaymentChipCounts(rows));
    } catch (error: any) {
      console.error("getPaymentStatusCounts Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }

  async updateInvoicePaymentStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        id,
        pay_status,
        dateOfDue,
        partialAmount = null,
        address,
        name,
        mobile_no,
        payment_notes,
        notes,
        payment_status_date,
        status_date,
      } = req.body;

      if (!id || !pay_status) return ReE(res, FORBIDDEN_CODE, "Missing id or pay_status");

      if (![...UPDATABLE_PAYMENT_STATUSES].includes(pay_status)) {
        return ReE(res, FORBIDDEN_CODE, "Invalid payment status");
      }

      const trimmedNotes = String(payment_notes ?? notes ?? "").trim();
      if (!trimmedNotes) {
        return ReE(res, BAD_REQUEST_CODE, "Notes are required for payment status updates");
      }
      const eventDateRaw = payment_status_date || status_date;
      if (!eventDateRaw) {
        return ReE(res, BAD_REQUEST_CODE, "Status date is required for payment status updates");
      }
      const parsedStatusDate = new Date(eventDateRaw);
      if (Number.isNaN(parsedStatusDate.getTime())) {
        return ReE(res, BAD_REQUEST_CODE, "Invalid status date");
      }

      const invoice: any = await invoiceRepository.findById(Number(id), {
        populate: {
          path: "quote",
          populate: { path: "customer", select: "id name email" },
        },
      });
      if (!invoice) return ReE(res, SERVER_ERROR_CODE, "Invoice not found");

      const now = new Date();
      const previousStatus = invoice.pay_status;
      const history = Array.isArray(invoice.payment_history) ? [...invoice.payment_history] : [];
      history.push({
        from: previousStatus,
        to: pay_status,
        reason: "payment_status_update",
        at: now,
        by: req.user?.id ?? null,
        notes: trimmedNotes,
        status_date: parsedStatusDate,
        partialAmount: pay_status === PaymentStatus.PARTIALLY_PAID ? partialAmount : null,
      });

      const updateData: Record<string, unknown> = {
        pay_status,
        status_updated_date: now,
        payment_notes: trimmedNotes,
        payment_status_date: parsedStatusDate,
        payment_history: history,
        address,
        partialAmount,
      };
      if (pay_status === PaymentStatus.PAID) updateData.paid_date = now;
      if (dateOfDue) updateData.dateOfDue = dateOfDue;
      if(name) updateData.name = name;
      if(mobile_no) updateData.mobile_no = mobile_no;

      const updated = await invoiceRepository.updateById(Number(id), { $set: updateData });
      const plain: any = updated?.toObject?.() ?? updated;
      const customerData = plain?.quote?.customer ?? plain?.quote;
      const emailPayload = {
        email: customerData.email,
        subject: "📄 Your Invoice Has Been Updated",
        client_name: customerData.name,
        id: plain.id,
        type: "INVOICE",
        title: `Invoice #${plain.id}`,
        status: pay_status,
        due_date: dateOfDue,
        link: `${process.env.FRONT_URL}/#/invoice/customer-view/${plain.id}/${plain.bypass_token}`,
        event: EVENT_TASK_TYPE.UPDATED
      };
      ReS(res, SUCCESS_CODE, "Payment status updated successfully", updated);

      await notificationController.createNotification({
        userId: req.user.id,
        message: `Invoice payment status updated to ${pay_status}`,
        route:`${process.env.FRONT_URL}/#/invoice/customer-view/${plain.id}/${plain.bypass_token}`,
        meta:{
          type: USER_NOTIFICATION_EVENT_TYPE.INVOICE,
          customerId: customerData.id,
          customerName: customerData.name,
          senderName: req.user.name,
          role: req.user.role
        }
      });
      SocketService.emit(SOCKET_EVENTS.USER_NOTIFICATION + `${plain.sender_id}`, {
        type: USER_NOTIFICATION_EVENT_TYPE.INVOICE,
        name: req.user.name,
        profile_image: req.user.profile_image,
        task_type: EVENT_TASK_TYPE.CREATED,
        message: `new Invoice created`,
      })
      SocketService.emit(SOCKET_EVENTS.USER_NOTIFICATION + `${customerData.id}`, {
        type: USER_NOTIFICATION_EVENT_TYPE.INVOICE,
        name: req.user.name,
        profile_image: req.user.profile_image,
        task_type: EVENT_TASK_TYPE.CREATED,
        message: `new Invoice created`,
      })
      return await sendEventEmail(emailPayload);
    } catch (error: any) {
      console.error("updateInvoicePaymentStatus Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }
}

export default new InvoiceController();
