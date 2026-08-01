import dashboardController from "@controllers/dashboard.controller";
import { Router } from "express";
const router = Router();

router.get('/workbench/metrics',dashboardController.getDashboardMetrics.bind(dashboardController));
router.get('/workbench/top-jobs-quotes-invoices',dashboardController.getTopJobsInvoiceQuotes.bind(dashboardController));
router.get('/workbench/top-installers-customers',dashboardController.getTopEntities.bind(dashboardController));
router.get('/workbench/invoice-revenue',dashboardController.getRevenueOverTime.bind(dashboardController));
router.get('/workbench/custom-invoice-revenue',dashboardController.getCustomInvoiceRevenueOverTime.bind(dashboardController));
export default router;