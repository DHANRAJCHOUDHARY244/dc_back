import paymentHistoryController from "@controllers/paymentHistory.controller";
import { Router } from "express";
const router = Router();
router.post('/create',paymentHistoryController.createPayment.bind(paymentHistoryController));
router.get('/',paymentHistoryController.getPaymentByQuoteId.bind(paymentHistoryController));
router.delete('/:id',paymentHistoryController.deletePayment.bind(paymentHistoryController));
router.put('/intaller/:id',paymentHistoryController.updateInstaller.bind(paymentHistoryController));
router.put('/sales-person/:id',paymentHistoryController.updateSalesPerson.bind(paymentHistoryController));
export default router