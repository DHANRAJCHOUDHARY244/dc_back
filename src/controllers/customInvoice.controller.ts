import { AuthenticatedRequest } from "@constants/common.interface";
import { newCustomInvoice } from "@constants/customInvoice.constants";
import { customInvoiceRepository, roleRepository, userRepository } from "@repositories";
import { generate_Hash_Password, generateRandomString, generateUUID, ReE, ReS } from "@services/generalHelper.service";
import { BAD_REQUEST_CODE, SERVER_ERROR_CODE, SUCCESS_CODE } from "@constants/serverCode";
import { PaymentStatus } from "@constants/common.enum";
import { EVENT_TASK_TYPE } from "@constants/socket.constants";
import notificationController from "./notification.controller";
import { sendEventEmail } from "@services/email.service";
import { Response } from "express";
import { fileUpload } from 'express-fileupload';
import { s3Service } from "@services/s3.service";
import { Roles } from "src/data/dataInserter";
import {
    applyInvoicePaymentChipFilter,
    computeInvoicePaymentChipCounts,
    emptyInvoicePaymentCounts,
    UPDATABLE_PAYMENT_STATUSES,
} from "@services/invoicePaymentChips.service";

const customInvoiceListPopulate = [
  { path: "customer", select: "id name email mobile_no address" },
];

class CustomInvoiceController {
    async updateOrCreateCustomInvoice(data: newCustomInvoice, sender_id: number, emailData: any) {
        const {
            customerId: customer_id,
            invoiceNumber = null,
            currency,
            dateOfDue,
            custName,
            custEmail,
            custAddress,
            subTotal,
            taxRate,
            taxAmount,
            discountAmount,
            discountRate,
            discountMode,
            total,
            items,
            pay_status,
            partialAmount,
            loan_enabled = false,
            loan_meta = null,
            notes = "",
        } = data;
        const now = new Date();
        const payload: any = {
            customer_id,
            sender_id,
            currency,
            dateOfDue,
            custName,
            custEmail,
            custAddress,
            subTotal,
            taxRate,
            taxAmount,
            discountAmount,
            discountRate,
            discountMode: discountMode === "amount" ? "amount" : "rate",
            total,
            items,
            pay_status,
            partialAmount,
            loan_enabled,
            loan_meta,
            name: custName,
            address: custAddress,
            notes: String(notes || "").trim(),
            status_updated_date: now,
        };
        if (pay_status === "PAID") payload.paid_date = now;
        let customInvoice;
        let isUpdate = false;
        if (invoiceNumber) {
            const updated = await customInvoiceRepository.updateById(Number(invoiceNumber), {
                $set: payload,
            });
            if (updated) {
                isUpdate = true;
                customInvoice = await customInvoiceRepository.findOne({
                    id: Number(invoiceNumber),
                    customer_id,
                });
            }
        }
        if (!customInvoice) {
            payload.bypass_token = generateRandomString();
            customInvoice = await customInvoiceRepository.create({ ...payload });
        }
        return { customInvoice, isUpdate };
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
                    {
                        email: body.custEmail,
                    },
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

            const { customInvoice, isUpdate } = await this.updateOrCreateCustomInvoice(
                {
                    ...body,
                    customerId,
                    invoiceNumber,
                },
                adminData.id,
                emailData,
            );

            ReS(res, SUCCESS_CODE, "Custom invoice processed successfully", customInvoice);
            return (async () => {
                try {
                    const emailPayload = {
                        email: body.custEmail,
                        subject: isUpdate
                            ? "📄 Your Quotation Has Been Updated"
                            : "📄 Your New Quotation Has Been Created",
                        client_name: body.custName,
                        id: customInvoice.id,
                        type: "INVOICE",
                        title: `Invoice #${customInvoice.id}`,
                        status: "Created",
                        due_date: customInvoice.dateOfDue,
                        link: `${process.env.FRONT_URL}/#/custom-invoice/customer-view/${customInvoice.id}/${customInvoice.bypass_token}`,
                        event: isUpdate ? EVENT_TASK_TYPE.UPDATED : EVENT_TASK_TYPE.CREATED,
                    };
                    await notificationController.createNotification({
                        userId: adminData.id,
                        message: isUpdate
                            ? `Invoice #${customInvoice.id} has been updated.`
                            : `New Invoice #${customInvoice.id} has been created.`,
                        route: `${process.env.FRONT_URL}/#/custom-invoice/customer-view/${customInvoice.id}/${customInvoice.bypass_token}`,
                        meta: {
                            customerId: customInvoice.customer_id,
                            customerName: customInvoice.custName,
                            type: "INVOICE",
                            senderName: adminData.name,
                            role: adminData.role
                        }
                    })
                    await sendEventEmail(emailPayload);
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
            const { customInvoice } = await this.updateOrCreateCustomInvoice(
                {
                    ...body,
                    customerId,
                    invoiceNumber,
                },
                adminData.id,
                {}
            );
            return ReS(res, SUCCESS_CODE, "Invoice updated successfully", customInvoice);
        } catch (error) {
            console.error("Error in Update:", error);
            return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
        }
    }
    async deleteCustomInvoice(req: AuthenticatedRequest, res: Response) {
        try {
            const id = Number(req.params.id);

            if (!id) {
                return ReE(res, SERVER_ERROR_CODE, "CustomInvoice ID is required");
            }

            const customInvoice = await customInvoiceRepository.findOne({
                id,
                sender_id: req.user.id,
            });

            if (!customInvoice) {
                return ReE(
                    res,
                    SERVER_ERROR_CODE,
                    "CustomInvoice not found or you do not have permission to delete it",
                );
            }

            await customInvoiceRepository.deleteById(id);
            await notificationController.createNotification({
                userId: req.user.id,
                message: `CustomInvoice #${id} has been deleted.`,
                route: null,
                meta: {
                    type: "INVOICE",
                    senderName: req.user.name,
                    role: req.user.role
                }
            });
            return ReS(res, SUCCESS_CODE, "CustomInvoice deleted successfully");
        } catch (error: any) {
            console.error("Error in deleteCustomInvoice:", error);
            return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
        }
    }
    async getCustomInvoiceById(req: AuthenticatedRequest, res: Response) {
        try {
            const id = Number(req.params.id);
            const bypass_token = req.bypass_token;
            const filters: any = { id };
            if (!id) return ReE(res, SERVER_ERROR_CODE, "CustomInvoice ID is required");
            if (bypass_token) filters.bypass_token = bypass_token

            const customInvoice = await customInvoiceRepository.findOne(
                { ...filters },
                {
                    populate: {
                        path: "customer",
                        select: "id name email address mobile_no",
                    },
                },
            );

            if (!customInvoice) {
                return ReE(res, SERVER_ERROR_CODE, "CustomInvoice not found");
            }

            return ReS(res, SUCCESS_CODE, "CustomInvoice fetched successfully", customInvoice);
        } catch (error: any) {
            console.error("Error in getCustomInvoiceById:", error);
            return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
        }
    }
    async getCustomInvoices(req: AuthenticatedRequest, res: Response) {
        try {
            const { user } = req;
            const {
                limit = 10,
                page = 1,
                cust_name = null,
                cust_email = null,
                start_date,
                end_date,
                pay_status,
                order_by = 'created_at',
                order_direction = 'DESC'
            } = req.body;
            const parsedLimit = parseInt(limit as string, 10);
            const parsedPage = parseInt(page as string, 10);

            const filter: any = {};
           if (user.role !== Roles.SUPER_ADMIN && user.role!== Roles.CUSTOMER_SUPPORT_EXECUTIVE ) {
                
                 filter.$or = [{ sender_id: user.id }, { customer_id: user.id }]
            }
            if (pay_status) applyInvoicePaymentChipFilter(filter, pay_status, { supportDiscountFields: true });
            if (start_date && end_date) {
                filter.created_at = {
                    $gte: new Date(start_date),
                    $lte: new Date(end_date),
                };
            }

            const needsCustomerFilter = cust_name || cust_email;
            if (needsCustomerFilter) {
                const customerFilter: Record<string, unknown> = {};
                if (cust_name) customerFilter.name = { $regex: cust_name, $options: "i" };
                if (cust_email) customerFilter.email = { $regex: cust_email, $options: "i" };
                const matchingCustomers = await userRepository.find(customerFilter, {
                    select: "id",
                    lean: true,
                });
                const customerIds = matchingCustomers.map((c: any) => c.id);
                filter.customer_id = { $in: customerIds };
            }

            const { count, rows: customInvoices } = await customInvoiceRepository.findPaginated(
                filter,
                {
                    page: parsedPage,
                    limit: parsedLimit,
                    sort: { [order_by]: order_direction === "DESC" ? -1 : 1 },
                    populate: customInvoiceListPopulate,
                },
            );
            return ReS(res, SUCCESS_CODE, "Quotes fetched successfully", {
                currentPage: parsedPage,
                totalPages: Math.ceil(count / parsedLimit),
                limit: parsedLimit,
                totalInvoices: count,
                data: customInvoices,
            });
        } catch (error: any) {
            console.error("Error in getCustomInvoices:", error);
            return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
        }
    }

    async getPaymentStatusCounts(req: AuthenticatedRequest, res: Response) {
        try {
            const { user } = req;
            const {
                cust_name = null,
                cust_email = null,
                start_date,
                end_date,
            } = req.body || {};

            const filter: any = {};
            if (user.role !== Roles.SUPER_ADMIN && user.role !== Roles.CUSTOMER_SUPPORT_EXECUTIVE) {
                if (user.id !== 299) filter.$or = [{ sender_id: user.id }, { customer_id: user.id }];
            }

            if (start_date && end_date) {
                filter.created_at = {
                    $gte: new Date(start_date),
                    $lte: new Date(end_date),
                };
            }

            const needsCustomerFilter = cust_name || cust_email;
            if (needsCustomerFilter) {
                const customerFilter: Record<string, unknown> = {};
                if (cust_name) customerFilter.name = { $regex: cust_name, $options: "i" };
                if (cust_email) customerFilter.email = { $regex: cust_email, $options: "i" };
                const matchingCustomers = await userRepository.find(customerFilter, {
                    select: "id",
                    lean: true,
                });
                if (!matchingCustomers.length) {
                    return ReS(res, SUCCESS_CODE, "Payment status counts", emptyInvoicePaymentCounts());
                }
                filter.customer_id = { $in: matchingCustomers.map((c: any) => c.id) };
            }

            const invoices: any[] = await customInvoiceRepository.find(filter, {
                select: "pay_status dateOfDue discountAmount discountRate",
                lean: true,
            });

            return ReS(
                res,
                SUCCESS_CODE,
                "Payment status counts",
                computeInvoicePaymentChipCounts(invoices),
            );
        } catch (error: any) {
            console.error("Error in getPaymentStatusCounts:", error);
            return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
        }
    }

    async updatePaymentStatus(req: AuthenticatedRequest, res: Response) {
        try {
            const {
                id,
                pay_status,
                partialAmount = null,
                payment_notes,
                notes,
                payment_status_date,
                status_date,
            } = req.body;

            if (!id || !pay_status) {
                return ReE(res, BAD_REQUEST_CODE, "Missing id or pay_status");
            }

            const validStatuses = [...UPDATABLE_PAYMENT_STATUSES];
            if (!validStatuses.includes(pay_status)) {
                return ReE(res, BAD_REQUEST_CODE, "Invalid payment status");
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

            const invoice: any = await customInvoiceRepository.findOne(invoiceFilter);
            if (!invoice) {
                return ReE(res, SERVER_ERROR_CODE, "CustomInvoice not found or access denied");
            }

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
            };
            if (pay_status === PaymentStatus.PAID) updateData.paid_date = now;
            if (pay_status === PaymentStatus.PARTIALLY_PAID) {
                updateData.partialAmount = partialAmount;
            }

            const updated = await customInvoiceRepository.updateById(Number(id), { $set: updateData });
            return ReS(res, SUCCESS_CODE, "Payment status updated successfully", updated);
        } catch (error: any) {
            console.error("Error in updatePaymentStatus:", error);
            return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error.message}`);
        }
    }

    async addAttachments(req: AuthenticatedRequest, res: Response) {
        try {
            const attachments: any[] = [];

            if (req.files) {
                const files = req.files as fileUpload.FileArray;

                for (const key in files) {
                    const file = files[key];
                    const fileArray = Array.isArray(file) ? file : [file];

                    for (const f of fileArray) {
                        const ext = f.name.split(".").pop();
                        const fileName = `quote_attach/${generateUUID(6)}.${ext}`;
                        const fileUrl = await s3Service.uploadFile(f.data, fileName, f.mimetype);

                        attachments.push(fileUrl);
                    }
                }
            }


            return ReS(res, SUCCESS_CODE, "Attachment successfully added", attachments);
        } catch (err) {
            console.error(err);
            return ReE(res, SERVER_ERROR_CODE, "Failed to add Attachment");
        }
    }
}
export default new CustomInvoiceController();
