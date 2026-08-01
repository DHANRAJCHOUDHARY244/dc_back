import { AuthenticatedRequest } from "@constants/common.interface";
import { newCustomInvoice } from "@constants/customInvoice.constants";
import { customInvoiceRepository, roleRepository, userRepository } from "@repositories";
import { generate_Hash_Password, generateRandomString, generateUUID, ReE, ReS } from "@services/generalHelper.service";
import { SERVER_ERROR_CODE, SUCCESS_CODE } from "@constants/serverCode";
import { EVENT_TASK_TYPE } from "@constants/socket.constants";
import notificationController from "./notification.controller";
import { sendEventEmail } from "@services/email.service";
import { Response } from "express";
import { fileUpload } from 'express-fileupload';
import { s3Service } from "@services/s3.service";
import { Roles } from "src/data/dataInserter";

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
            email: custEmail,
            address: custAddress,
            status_updated_date: now,
        }
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
                        $or: [{ email: body.custEmail }, { username: body.custName }],
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
                        username: body.custName.toLowerCase(),
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
                if(user.id !==299)
                 filter.$or = [{ sender_id: user.id }, { customer_id: user.id }]
            }
            if (pay_status) filter.pay_status = pay_status;
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
