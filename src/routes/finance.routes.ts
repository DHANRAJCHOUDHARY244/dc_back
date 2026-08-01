import financeController from '@controllers/finance.controller';
import accountsStockInvoiceController from '@controllers/accountsStockInvoice.controller';
import accountsStockDeliveryController from '@controllers/accountsStockDelivery.controller';
import accountsInstallerInvoiceController from '@controllers/accountsInstallerInvoice.controller';
import accountsRebateController from '@controllers/accountsRebate.controller';
import accountsPreApprovalGridController from '@controllers/accountsPreApprovalGrid.controller';
import accountsMarketingController from '@controllers/accountsMarketing.controller';
import accountsSalesCommissionController from '@controllers/accountsSalesCommission.controller';
import { Router } from 'express';
const router = Router();
router.get('/dashboard',financeController.dashboard.bind(financeController));
router.get('/accounts',financeController.accounts.bind(financeController));
router.put('/budget',financeController.updateBudget.bind(financeController));

/** Manual supplier stock invoices (Accounts) — separate from quote stock orders */
router.get('/stock-invoices', accountsStockInvoiceController.list.bind(accountsStockInvoiceController));
router.get('/stock-invoices/:id', accountsStockInvoiceController.getById.bind(accountsStockInvoiceController));
router.post('/stock-invoices', accountsStockInvoiceController.create.bind(accountsStockInvoiceController));
router.put('/stock-invoices/:id', accountsStockInvoiceController.update.bind(accountsStockInvoiceController));
router.delete('/stock-invoices/:id', accountsStockInvoiceController.remove.bind(accountsStockInvoiceController));
router.post('/stock-invoices/:id/attachments', accountsStockInvoiceController.uploadAttachments.bind(accountsStockInvoiceController));
router.delete('/stock-invoices/:id/attachments', accountsStockInvoiceController.deleteAttachment.bind(accountsStockInvoiceController));

/** Manual stock deliveries (Accounts) — delivery company & deliverer details */
router.get('/stock-deliveries', accountsStockDeliveryController.list.bind(accountsStockDeliveryController));
router.get('/stock-deliveries/:id', accountsStockDeliveryController.getById.bind(accountsStockDeliveryController));
router.post('/stock-deliveries', accountsStockDeliveryController.create.bind(accountsStockDeliveryController));
router.put('/stock-deliveries/:id', accountsStockDeliveryController.update.bind(accountsStockDeliveryController));
router.delete('/stock-deliveries/:id', accountsStockDeliveryController.remove.bind(accountsStockDeliveryController));
router.post('/stock-deliveries/:id/attachments', accountsStockDeliveryController.uploadAttachments.bind(accountsStockDeliveryController));
router.delete('/stock-deliveries/:id/attachments', accountsStockDeliveryController.deleteAttachment.bind(accountsStockDeliveryController));

/** Manual installer invoices/payments (Accounts) — installer & company details */
router.get('/installer-invoices', accountsInstallerInvoiceController.list.bind(accountsInstallerInvoiceController));
router.get('/installer-invoices/:id', accountsInstallerInvoiceController.getById.bind(accountsInstallerInvoiceController));
router.post('/installer-invoices', accountsInstallerInvoiceController.create.bind(accountsInstallerInvoiceController));
router.put('/installer-invoices/:id', accountsInstallerInvoiceController.update.bind(accountsInstallerInvoiceController));
router.delete('/installer-invoices/:id', accountsInstallerInvoiceController.remove.bind(accountsInstallerInvoiceController));
router.post('/installer-invoices/:id/attachments', accountsInstallerInvoiceController.uploadAttachments.bind(accountsInstallerInvoiceController));
router.delete('/installer-invoices/:id/attachments', accountsInstallerInvoiceController.deleteAttachment.bind(accountsInstallerInvoiceController));

/** Manual rebates (Accounts) — STC / BSTC / Solar Victoria / Interest Free Loan / Instant Rebate */
router.get('/rebates', accountsRebateController.list.bind(accountsRebateController));
router.get('/rebates/:id', accountsRebateController.getById.bind(accountsRebateController));
router.post('/rebates', accountsRebateController.create.bind(accountsRebateController));
router.put('/rebates/:id', accountsRebateController.update.bind(accountsRebateController));
router.delete('/rebates/:id', accountsRebateController.remove.bind(accountsRebateController));
router.post('/rebates/:id/attachments', accountsRebateController.uploadAttachments.bind(accountsRebateController));
router.delete('/rebates/:id/attachments', accountsRebateController.deleteAttachment.bind(accountsRebateController));

/** Manual pre-approval / grid connection records (Accounts) */
router.get('/pre-approval-grid', accountsPreApprovalGridController.list.bind(accountsPreApprovalGridController));
router.get('/pre-approval-grid/:id', accountsPreApprovalGridController.getById.bind(accountsPreApprovalGridController));
router.post('/pre-approval-grid', accountsPreApprovalGridController.create.bind(accountsPreApprovalGridController));
router.put('/pre-approval-grid/:id', accountsPreApprovalGridController.update.bind(accountsPreApprovalGridController));
router.delete('/pre-approval-grid/:id', accountsPreApprovalGridController.remove.bind(accountsPreApprovalGridController));
router.post('/pre-approval-grid/:id/attachments', accountsPreApprovalGridController.uploadAttachments.bind(accountsPreApprovalGridController));
router.delete('/pre-approval-grid/:id/attachments', accountsPreApprovalGridController.deleteAttachment.bind(accountsPreApprovalGridController));

/** Marketing ads (Accounts) — connected to MARKETING expenses, with invoice number + attachments */
router.get('/marketing', accountsMarketingController.list.bind(accountsMarketingController));
router.get('/marketing/:id', accountsMarketingController.getById.bind(accountsMarketingController));
router.post('/marketing', accountsMarketingController.create.bind(accountsMarketingController));
router.put('/marketing/:id', accountsMarketingController.update.bind(accountsMarketingController));
router.delete('/marketing/:id', accountsMarketingController.remove.bind(accountsMarketingController));
router.post('/marketing/:id/attachments', accountsMarketingController.uploadAttachments.bind(accountsMarketingController));
router.delete('/marketing/:id/attachments', accountsMarketingController.deleteAttachment.bind(accountsMarketingController));

/** Manual sales commissions (Accounts) — salesperson, customer, fixed/percentage, install date */
router.get('/sales-commissions', accountsSalesCommissionController.list.bind(accountsSalesCommissionController));
router.get('/sales-commissions/:id', accountsSalesCommissionController.getById.bind(accountsSalesCommissionController));
router.post('/sales-commissions', accountsSalesCommissionController.create.bind(accountsSalesCommissionController));
router.put('/sales-commissions/:id', accountsSalesCommissionController.update.bind(accountsSalesCommissionController));
router.delete('/sales-commissions/:id', accountsSalesCommissionController.remove.bind(accountsSalesCommissionController));
router.post('/sales-commissions/:id/attachments', accountsSalesCommissionController.uploadAttachments.bind(accountsSalesCommissionController));
router.delete('/sales-commissions/:id/attachments', accountsSalesCommissionController.deleteAttachment.bind(accountsSalesCommissionController));

export default router;
