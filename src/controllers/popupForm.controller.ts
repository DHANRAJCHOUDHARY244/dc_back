import { FORBIDDEN_CODE, RESOURCE_NOT_FOUND, SERVER_ERROR_CODE, SUCCESS_CODE } from "@constants/serverCode";
import { popupFormRepository, roleRepository, userRepository } from "@repositories";
import { generate_Hash_Password, generateRandomString, ReE, ReS } from "@services/generalHelper.service";
import { Request, Response } from "express";
import { Roles } from "src/data/dataInserter";
import { createEnquiryLead } from "@services/leadWorkflow.service";

class PopupFormController {
    async addAppendUser(data: { address: string; email: string; mobile: string; name: string; }) {
        try {
            const { address, email, mobile, name } = data;
            const user = await userRepository.findOne({
                email: email.toLowerCase(),
            });
            if (user) return;
            const hashedPassword = await generate_Hash_Password(
                generateRandomString(7),
            );
            const roleDoc: any =
                (await roleRepository.findOne(
                    { name: Roles.CUSTOMER },
                    { select: "id", lean: true },
                )) || {};
            const roleId = roleDoc?.id ?? null;
            await userRepository.create({
                name,
                username: email,
                email: email.toLowerCase(),
                mobile_no: mobile,
                address,
                password: hashedPassword,
                role_id: roleId,
            });
            return true;
        } catch (error) {
            console.error(`Error in addAppendUser: ${error}`);
        }
    }
    async handlePopupFormSubmission(req: Request, res: Response) {
        try {
            const { address, email, mobile, name, message, product } = req.body;
            
            await this.addAppendUser({ address, email, mobile, name });
            const saved: any = await popupFormRepository.create({ name, email, mobile, address, message, product });

            let leadResult: any = null;
            try {
                leadResult = await createEnquiryLead({
                    name,
                    phone: mobile,
                    email,
                    address,
                    source: "Landing Page",
                    interested_in: product ? [String(product)] : [],
                    note: message,
                    preferred_contact: "WhatsApp",
                    popup_id: saved?.id,
                });
            } catch (leadErr) {
                console.error("Popup form → lead sync failed:", leadErr);
            }

            return ReS(res, 200, "Form submitted successfully", {
                lead_id: leadResult?.lead?.id ?? null,
                welcome_message: leadResult?.welcome_message ?? null,
            });
        } catch (error) {
            return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
        }
    }
    async getAllPopupForms(req: Request, res: Response) {
        try {
            const { page = 1, limit = 10, name, email, mobile, product,
                start_date, end_date, sort_by = "created_at", order = "DESC", } = req.body;
            const filter: Record<string, unknown> = {};
            const andConditions: Record<string, unknown>[] = [];

            if (name) {
                andConditions.push({ name: { $regex: name, $options: "i" } });
            }
            if (email) {
                andConditions.push({ email: { $regex: email, $options: "i" } });
            }
            if (product) {
                andConditions.push({ product: { $regex: product, $options: "i" } });
            }
            if (mobile) {
                andConditions.push({ mobile: { $regex: mobile, $options: "i" } });
            }
            if (andConditions.length) {
                filter.$and = andConditions;
            }
            if (start_date && end_date) {
                filter.createdAt = {
                    $gte: new Date(start_date),
                    $lte: new Date(end_date),
                };
            } else if (start_date) {
                filter.createdAt = { $gte: new Date(start_date) };
            } else if (end_date) {
                filter.createdAt = { $lte: new Date(end_date) };
            }

            const { rows: submissions, count: totalItems } = await popupFormRepository.findPaginated(
                filter,
                {
                    page: Number(page),
                    limit: Number(limit),
                    sort: { [sort_by]: order === "DESC" ? -1 : 1 },
                },
            );
            if (!submissions || submissions.length === 0) 
                return ReS(res, 200, "No popup form submissions found", []);
            return ReS(res, 200, "Popup form submissions retrieved successfully", {
                data: submissions,
                totalItems,
                totalPages: Math.ceil(totalItems / limit),
                currentPage: page,
            });
        } catch (error) {
            return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
        }
    }
    async getPopupFormAnalytics(req: Request, res: Response) {
        try {
            const { started_date, end_date }: { started_date?: string; end_date?: string } = req.query;

            const matchStage: Record<string, unknown> = {};
            if (started_date && end_date) {
                matchStage.createdAt = {
                    $gte: new Date(started_date),
                    $lte: new Date(end_date),
                };
            } else if (started_date) {
                matchStage.createdAt = { $gte: new Date(started_date) };
            } else if (end_date) {
                matchStage.createdAt = { $lte: new Date(end_date) };
            }

            const pipelineMatch = Object.keys(matchStage).length
                ? [{ $match: matchStage }]
                : [];

            const totalCount = await popupFormRepository.count(matchStage);

            const submissionsByMonth = await popupFormRepository.aggregateRaw([
                ...pipelineMatch,
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m", date: "$created_at" } },
                        count: { $sum: 1 },
                    },
                },
                { $project: { _id: 0, month: "$_id", count: 1 } },
                { $sort: { month: 1 } },
            ]);

            const productDistribution = await popupFormRepository.aggregateRaw([
                ...pipelineMatch,
                { $group: { _id: "$product", count: { $sum: 1 } } },
                { $project: { _id: 0, product: "$_id", count: 1 } },
                { $sort: { count: -1 } },
            ]);

            const submissionsByDayOfWeek = await popupFormRepository.aggregateRaw([
                ...pipelineMatch,
                {
                    $group: {
                        _id: { $dayOfWeek: "$created_at" },
                        count: { $sum: 1 },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        day: {
                            $arrayElemAt: [
                                ["", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
                                "$_id",
                            ],
                        },
                        count: 1,
                    },
                },
            ]);

            const recentSubmissions = await popupFormRepository.find(matchStage, {
                sort: { createdAt: -1 },
                limit: 5,
                lean: true,
            });

            return ReS(res, SUCCESS_CODE, "Popup analytics data retrieved successfully", {
                totalCount,
                submissionsByMonth,
                productDistribution,
                submissionsByDayOfWeek,
                recentSubmissions,
            });
        } catch (error) {
            return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
        }
    }

    async getPopupFormById(req:Request,res:Response){
        try {
            const id = Number(req.params.id);
            if(!id) return ReE(res,FORBIDDEN_CODE,"Id must required!");
            const form = await popupFormRepository.findById(id);
            if(!form) return ReE(res,RESOURCE_NOT_FOUND,"Form not found");
            return ReS(res,SUCCESS_CODE,"Form fetch Successfully",form);
        } catch (error) {
            return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
        }
    }
}
export default new PopupFormController();
