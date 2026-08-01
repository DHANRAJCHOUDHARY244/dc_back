
import express from 'express';
const router = express.Router();
import  invoiceController  from '@controllers/invoice.controller';
import { bypassValidation } from 'src/middleware/bypass_token.middleware';

// 🧾 Create or update invoice (Upsert)
// 📄 Get paginated & filtered list of invoices
// 🔍 Get a single invoice by ID
// 🗑️ Delete an invoice by ID
// 💳 Update payment status (Paid / Cancelled / Pending)
router.post("/v1/add", invoiceController.createOrUpdateInvoice.bind(invoiceController));
router.post("/v1/invoices",  invoiceController.getInvoices.bind(invoiceController));
router.get("/:id",bypassValidation, invoiceController.getInvoiceById.bind(invoiceController));
router.delete("/v1/:id", invoiceController.deleteInvoice.bind(invoiceController));
router.put("/v1/payment-status", invoiceController.updateInvoicePaymentStatus.bind(invoiceController));

export default router;