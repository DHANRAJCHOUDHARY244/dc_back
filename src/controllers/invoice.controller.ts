import { Response } from "express";
import {
  invoiceRepository,
  quoteRepository,
  quoteWorkflowRepository,
  userRepository,
} from "@repositories";
import { ReE, ReS } from "@services/generalHelper.service";
import { SERVER_ERROR_CODE, SUCCESS_CODE, FORBIDDEN_CODE, RESOURCE_NOT_FOUND, BAD_REQUEST_CODE, UNAUTHORIZED_CODE } from "@constants/serverCode";
import { AuthenticatedRequest } from "@constants/common.interface";
import { PaymentStatus, QuoteCustomerStatus } from "@constants/common.enum";
import { EVENT_TASK_TYPE, USER_NOTIFICATION_EVENT_TYPE } from "@constants/socket.constants";
import { sendEventEmail } from "@services/email.service";
import { dispatchNotification } from "@services/notificationHandler.service";
import { buildInvoiceNotificationSocketPayload } from "@services/notificationPayload.service";
import { Roles } from './../data/dataInserter';
import { isQuoteAdmin } from "@services/adminPermission.service";
import {
  buildQuoteInvoiceListFilter,
  canAccessQuoteInvoice,
} from "@services/invoiceAccess.service";
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
          select: "bypass_token customer_accepted name mobile_no sender_id customer_id",
          populate: { path: "customer", select: "id name email" },
          lean: true,
        },
      );

      if (!quote)
        return ReE(res, RESOURCE_NOT_FOUND, "Quote not found for the provided quote_id and sender.");

      const canInvoice =
        Number(quote.sender_id) === Number(sender_id) ||
        req.user.role === Roles.SUPER_ADMIN ||
        (await isQuoteAdmin(req.user));
      if (!canInvoice) {
        return ReE(res, FORBIDDEN_CODE, "You do not have permission to invoice this quote");
      }

      const CustName = name
                       ? name
                         : quote.name
                             ? quote.name
                                : quote.customer?.name;

      if (quote.customer_accepted !== QuoteCustomerStatus.ACCEPTED)
        return ReE(res, BAD_REQUEST_CODE, "Quote is not accepted by customer");

      const customerData = quote.customer;
      if (!customerData?.email) {
        return ReE(res, BAD_REQUEST_CODE, "Quote customer email is required to create an invoice");
      }

      const existingInvoice = await invoiceRepository.findOne({ quote_id });

      if (existingInvoice)
        return ReS(res, SUCCESS_CODE, "Invoice already exists", existingInvoice);
      const invoice: any = await invoiceRepository.create({
        quote_id, sender_id,
        bypass_token: quote.bypass_token,
        pay_status: PaymentStatus.PENDING,
        dateOfDue, address,
        name: CustName,
        mobile_no: quote.mobile_no,
        status_updated_date: new Date(),
      });
      const emailPayload = {
        email: customerData.email,
        subject: "📄 Your Invoice Has Been Created",
        client_name: customerData.name,
        id: invoice.id,
        type: "INVOICE",
        title: `Invoice #${invoice.id}`,
        status: PaymentStatus.PENDING,
        due_date: dateOfDue,
        link: `${process.env.FRONT_URL}/#/invoice/customer-view/${invoice.id}/${quote.bypass_token}`,
        event: EVENT_TASK_TYPE.CREATED
      };
      ReS(res, SUCCESS_CODE, "Invoice created successfully", invoice);
      await quoteWorkflowRepository.updateMany(
        { quote_id },
        { $set: { invoice_id: invoice.id } },
      );
      const invoiceRoute = `${process.env.FRONT_URL}/#/invoice/customer-view/${invoice.id}/${quote.bypass_token}`;
      const invoiceMessage = "new Invoice created";
      const socketPayload = buildInvoiceNotificationSocketPayload({
        message: invoiceMessage,
        task_type: EVENT_TASK_TYPE.CREATED,
        sender: { name: req.user.name, profile_image: req.user.profile_image },
        route: invoiceRoute,
      });
      await dispatchNotification({
        userId: sender_id,
        message: invoiceMessage,
        route: invoiceRoute,
        meta: {
          type: USER_NOTIFICATION_EVENT_TYPE.INVOICE,
          customerId: customerData.id,
          customerName: customerData.name,
          senderName: req.user.name,
          role: req.user.role,
        },
        socket: { payload: socketPayload },
      });
      await dispatchNotification({
        userId: customerData.id,
        message: invoiceMessage,
        route: invoiceRoute,
        meta: {
          type: USER_NOTIFICATION_EVENT_TYPE.INVOICE,
          customerId: customerData.id,
          customerName: customerData.name,
          senderName: req.user.name,
          role: req.user.role,
        },
        socket: { payload: socketPayload },
      });
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

      const accessFilter = await buildQuoteInvoiceListFilter(req.user);
      const filter: Record<string, unknown> = { ...accessFilter };

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

      if (!id) return ReE(res, SERVER_ERROR_CODE, "Invoice ID is required");

      let filter: Record<string, unknown>;
      if (bypass_token) {
        filter = { id: Number(id), bypass_token };
      } else if (!req.user?.id) {
        return ReE(res, UNAUTHORIZED_CODE, "Unauthorized");
      } else {
        // Match getInvoices: any authenticated staff user may view invoices by id.
        filter = { id: Number(id) };
      }

      const invoice: any = await invoiceRepository.findOne(filter, {
        populate: invoiceDetailPopulate,
      });

      if (!invoice) return ReE(res, SERVER_ERROR_CODE, "Invoice not found");

      if (!bypass_token) {
        const quote = invoice.quote as { customer_id?: number; sender_id?: number } | undefined;
        const allowed = await canAccessQuoteInvoice(req.user, invoice, quote);
        if (!allowed) {
          return ReE(res, FORBIDDEN_CODE, "Forbidden");
        }
      }

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
      const invoice: any = await invoiceRepository.findOne(filter);

      if (!invoice) return ReE(res, SERVER_ERROR_CODE, "Invoice not found or access denied");

      await invoiceRepository.deleteById(Number(id));
      if (invoice.quote_id) {
        await quoteWorkflowRepository.updateMany(
          { quote_id: invoice.quote_id },
          { $unset: { invoice_id: "" } },
        );
      }
      await dispatchNotification({
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
      const accessFilter = await buildQuoteInvoiceListFilter(req.user);
      const filter: Record<string, unknown> = { ...accessFilter };

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

      const invoiceFilter: Record<string, unknown> = { id: Number(id) };
      if (req.user.role !== Roles.SUPER_ADMIN) {
        invoiceFilter.sender_id = req.user.id;
      }

      const invoice: any = await invoiceRepository.findOne(invoiceFilter, {
        populate: {
          path: "quote",
          populate: { path: "customer", select: "id name email" },
        },
      });
      if (!invoice) return ReE(res, SERVER_ERROR_CODE, "Invoice not found or access denied");

      const quote = invoice.quote as { customer?: { id?: number; name?: string; email?: string }; custEmail?: string; email?: string; name?: string } | undefined;
      const customerData = quote?.customer ?? null;
      const customerEmail = String(
        customerData?.email ?? quote?.custEmail ?? quote?.email ?? "",
      ).trim();
      const customerName = customerData?.name ?? quote?.name ?? invoice.name ?? "Customer";
      const customerId = customerData?.id ?? null;

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
      };
      if (pay_status === PaymentStatus.PARTIALLY_PAID) {
        updateData.partialAmount = partialAmount;
      } else {
        updateData.partialAmount = null;
      }
      if (pay_status === PaymentStatus.PAID) updateData.paid_date = now;
      if (dateOfDue) updateData.dateOfDue = dateOfDue;
      if(name) updateData.name = name;
      if(mobile_no) updateData.mobile_no = mobile_no;

      const updated = await invoiceRepository.updateById(Number(id), { $set: updateData });
      const plain: any = updated?.toObject?.() ?? updated;

      ReS(res, SUCCESS_CODE, "Payment status updated successfully", updated);

      void (async () => {
        try {
          if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
            console.warn("Skipping invoice status email — invalid or missing customer email");
            return;
          }
          const emailPayload = {
            email: customerEmail,
            subject: "📄 Your Invoice Has Been Updated",
            client_name: customerName,
            id: plain.id,
            type: "INVOICE",
            title: `Invoice #${plain.id}`,
            status: pay_status,
            due_date: dateOfDue,
            link: `${process.env.FRONT_URL}/#/invoice/customer-view/${plain.id}/${plain.bypass_token}`,
            event: EVENT_TASK_TYPE.UPDATED,
          };
          const statusMessage = `Invoice payment status updated to ${pay_status}`;
          const statusRoute = `${process.env.FRONT_URL}/#/invoice/customer-view/${plain.id}/${plain.bypass_token}`;
          const statusSocketPayload = buildInvoiceNotificationSocketPayload({
            message: statusMessage,
            task_type: EVENT_TASK_TYPE.UPDATED,
            sender: { name: req.user.name, profile_image: req.user.profile_image },
            route: statusRoute,
          });
          await dispatchNotification({
            userId: req.user.id,
            message: statusMessage,
            route: statusRoute,
            meta: {
              type: USER_NOTIFICATION_EVENT_TYPE.INVOICE,
              customerId,
              customerName,
              senderName: req.user.name,
              role: req.user.role,
            },
            socket: { payload: statusSocketPayload },
          });
          if (plain.sender_id) {
            await dispatchNotification({
              userId: plain.sender_id,
              message: statusMessage,
              route: statusRoute,
              meta: {
                type: USER_NOTIFICATION_EVENT_TYPE.INVOICE,
                customerId,
                customerName,
                senderName: req.user.name,
                role: req.user.role,
              },
              socket: { payload: statusSocketPayload },
            });
          }
          if (customerId) {
            await dispatchNotification({
              userId: customerId,
              message: statusMessage,
              route: statusRoute,
              meta: {
                type: USER_NOTIFICATION_EVENT_TYPE.INVOICE,
                customerId,
                customerName,
                senderName: req.user.name,
                role: req.user.role,
              },
              socket: { payload: statusSocketPayload },
            });
          }
          await sendEventEmail(emailPayload);
        } catch (emailErr: any) {
          console.error("Invoice status email failed:", emailErr?.message || emailErr);
        }
      })();
      return;
    } catch (error: any) {
      console.error("updateInvoicePaymentStatus Error:", error);
      return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
    }
  }
}

export default new InvoiceController();
