import customInvoiceController from "@controllers/customInvoice.controller";
import { Router } from "express";
import { bypassValidation } from "src/middleware/bypass_token.middleware";
const router = Router();

router.post("/v1/add",customInvoiceController.addNew.bind(customInvoiceController));
router.put("/v1/update-custom-invoice", customInvoiceController.update.bind(customInvoiceController));
router.put("/v1/payment-status", customInvoiceController.updatePaymentStatus.bind(customInvoiceController));
router.post("/v1/payment-status-counts", customInvoiceController.getPaymentStatusCounts.bind(customInvoiceController));
router.delete("/v1/custom-invoice/:id", customInvoiceController.deleteCustomInvoice.bind(customInvoiceController));
router.get("/custom-invoice/:id",bypassValidation ,customInvoiceController.getCustomInvoiceById.bind(customInvoiceController));
router.post("/v1/custom-invoices", customInvoiceController.getCustomInvoices.bind(customInvoiceController));
router.post("/v1/add-attachments", customInvoiceController.addAttachments.bind(customInvoiceController));
export default router;