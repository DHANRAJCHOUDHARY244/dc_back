import { AuthenticatedRequest } from "./../constants/common.interface";
import { Response } from "express";
import { SERVER_ERROR_CODE, SUCCESS_CODE } from "@constants/serverCode";
import { ReE, ReS } from "@services/generalHelper.service";
import {
	customInvoiceRepository,
	invoiceRepository,
	quoteRepository,
} from "@repositories";
import { USER_NOTIFICATION_EVENT_TYPE } from "@constants/socket.constants";
import { TimeEnum } from "@constants/common.enum";
import { buildSalesPerformancePipeline } from "@services/salesPipeline.service";
import {
	getCustomInvoiceRevenueByInterval,
	getInvoiceRevenueByInterval,
	getWorkbenchMetricsPayload,
} from "@services/dashboardMetrics.service";
import { paginationMeta, parseMongoSort, parsePaginationParams } from "@utils/pagination.helper";

class DashboardController {
	async getDashboardMetrics(req: AuthenticatedRequest, res: Response) {
		try {
			const data = await getWorkbenchMetricsPayload();
			return ReS(res, SUCCESS_CODE, "Dashboard metrics retrieved successfully", data);
		} catch (error) {
			console.error("Dashboard Error:", error);
			return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
		}
	}

	async getTopJobsInvoiceQuotes(req: AuthenticatedRequest, res: Response) {
		try {
			const {
				type,
				page = 1,
				limit = 10,
				sortBy = "created_at",
				sortOrder = "DESC",
				pay_status = "PAID",
				customer_accepted = "ACCEPTED",
			} = req.query;

			const { page: parsedPage, limit: parsedLimit } = parsePaginationParams({ page, limit });
			const sort = parseMongoSort(sortBy, sortOrder);

			let result: { rows: unknown[]; count: number };

			switch (type) {
				case USER_NOTIFICATION_EVENT_TYPE.QUOTE:
					result = await quoteRepository.findPaginated(
						{ customer_accepted },
						{
							page: parsedPage,
							limit: parsedLimit,
							sort,
							select: "id customer_accepted total discountAmount taxAmount created_at updated_at name",
							populate: { path: "customer", select: "name" },
						},
					);
					break;

				case USER_NOTIFICATION_EVENT_TYPE.INVOICE:
					result = await invoiceRepository.findPaginated(
						{ pay_status },
						{
							page: parsedPage,
							limit: parsedLimit,
							sort,
							select: "id pay_status dateOfDue created_at updated_at name partialAmount",
							populate: {
								path: "quote",
								select: "id total discountAmount taxAmount created_at updated_at name",
								populate: { path: "customer", select: "name" },
							},
						},
					);
					break;

				case USER_NOTIFICATION_EVENT_TYPE.CUSTOM_INVOICE:
					result = await customInvoiceRepository.findPaginated(
						{ pay_status },
						{
							page: parsedPage,
							limit: parsedLimit,
							sort,
							select:
								"id pay_status dateOfDue created_at updated_at total discountAmount taxAmount name partialAmount",
							populate: { path: "customer", select: "name" },
						},
					);
					break;

				default:
					return ReE(
						res,
						SERVER_ERROR_CODE,
						"Invalid type parameter. Must be 'quotes' or 'invoices'.",
					);
			}

			return ReS(
				res,
				SUCCESS_CODE,
				`${String(type).charAt(0).toUpperCase() + String(type).slice(1)} fetched successfully`,
				{
					...paginationMeta(parsedPage, parsedLimit, result.count),
					data: result.rows,
				},
			);
		} catch (error) {
			console.error("Error fetching paginated jobs/quotes/invoices:", error);
			return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
		}
	}

	async getTopEntities(req: AuthenticatedRequest, res: Response) {
		try {
			const { type, page = 1, limit = 10 } = req.query;
			const { page: pageNum, limit: limitNum, skip } = parsePaginationParams({ page, limit });

			let results: unknown[];
			let message: string;

			switch (type) {
				case "top_salesPerson":
					results = await invoiceRepository.aggregateRaw([
						{
							$match: {
								deleted_at: null,
								pay_status: { $in: ["PAID", "PARTIAL_PAID"] },
							},
						},
						{ $group: { _id: "$sender_id", total_invoices: { $sum: 1 } } },
						{
							$setWindowFields: {
								sortBy: { total_invoices: -1 },
								output: { rank: { $denseRank: {} } },
							},
						},
						{ $sort: { rank: 1 } },
						{ $skip: skip },
						{ $limit: limitNum },
						{
							$lookup: {
								from: "users",
								localField: "_id",
								foreignField: "id",
								as: "user",
							},
						},
						{ $unwind: "$user" },
						{ $match: { "user.deleted_at": null } },
						{
							$project: {
								_id: 0,
								rank: 1,
								sender_id: "$_id",
								total_invoices: 1,
								name: "$user.name",
								email: "$user.email",
								profile_image: "$user.profile_image",
							},
						},
					]);
					message = "Top salespersons fetched successfully";
					break;

				case "top_customers":
					results = await invoiceRepository.aggregateRaw([
						{
							$match: {
								deleted_at: null,
								pay_status: { $in: ["PAID", "PARTIAL_PAID"] },
							},
						},
						{
							$lookup: {
								from: "quotes",
								localField: "quote_id",
								foreignField: "id",
								as: "quote",
							},
						},
						{ $unwind: "$quote" },
						{ $match: { "quote.deleted_at": null } },
						{ $group: { _id: "$quote.customer_id", total_paid_quotes: { $sum: 1 } } },
						{
							$setWindowFields: {
								sortBy: { total_paid_quotes: -1 },
								output: { rank: { $denseRank: {} } },
							},
						},
						{ $sort: { rank: 1 } },
						{ $skip: skip },
						{ $limit: limitNum },
						{
							$lookup: {
								from: "users",
								localField: "_id",
								foreignField: "id",
								as: "user",
							},
						},
						{ $unwind: "$user" },
						{ $match: { "user.deleted_at": null } },
						{
							$project: {
								_id: 0,
								rank: 1,
								customer_id: "$_id",
								total_paid_quotes: 1,
								name: "$user.name",
								email: "$user.email",
								profile_image: "$user.profile_image",
							},
						},
					]);
					message = "Top customers fetched successfully";
					break;

				default:
					return ReE(res, SERVER_ERROR_CODE, "Invalid type. Use 'top_installers' or 'top_customers'.");
			}

			return ReS(res, SUCCESS_CODE, message, {
				currentPage: pageNum,
				limit: limitNum,
				data: results,
			});
		} catch (error) {
			console.error("Error fetching top entities:", error);
			return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
		}
	}

	async getRevenueOverTime(req: AuthenticatedRequest, res: Response) {
		try {
			const interval: TimeEnum = (req.query.interval as TimeEnum) || TimeEnum.ALL_TIME;
			const data = await getInvoiceRevenueByInterval(interval);
			return ReS(res, SUCCESS_CODE, "Revenue over time fetched successfully", data);
		} catch (error) {
			console.error("getRevenueOverTime:", error);
			return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
		}
	}

	async getCustomInvoiceRevenueOverTime(req: AuthenticatedRequest, res: Response) {
		try {
			const interval: TimeEnum = (req.query.interval as TimeEnum) || TimeEnum.ALL_TIME;
			const data = await getCustomInvoiceRevenueByInterval(interval);
			return ReS(res, SUCCESS_CODE, "Revenue over time fetched successfully", data);
		} catch (error) {
			console.error("getCustomInvoiceRevenueOverTime:", error);
			return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
		}
	}

	async getSalesPerformancePipeline(req: AuthenticatedRequest, res: Response) {
		try {
			const daysRaw = req.query.days;
			const days =
				daysRaw === undefined || daysRaw === null || daysRaw === "" || daysRaw === "all"
					? null
					: Number(daysRaw);
			const data = await buildSalesPerformancePipeline(
				{ id: req.user.id, role: req.user.role },
				{ days: Number.isNaN(days as any) ? null : days },
			);
			return ReS(res, SUCCESS_CODE, "Sales Performance Pipeline retrieved", data);
		} catch (error) {
			console.error("getSalesPerformancePipeline:", error);
			return ReE(res, SERVER_ERROR_CODE, `Server Error: ${error}`);
		}
	}
}

export default new DashboardController();
