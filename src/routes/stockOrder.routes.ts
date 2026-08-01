import stockOrderController from "@controllers/stockOrder.controller";
import { Router } from "express"
import { bypassValidation } from "src/middleware/bypass_token.middleware";

const router = Router();

router.post("/v1/create",stockOrderController.createStockOrder.bind(stockOrderController));
router.patch("/confirm_stock/:id/:bypass_token",bypassValidation,stockOrderController.confirmStock.bind(stockOrderController));
router.patch("/delivered_stock/:id/:bypass_token",bypassValidation,stockOrderController.deliverStock.bind(stockOrderController));
router.put("/update/:id/:bypass_token",bypassValidation,stockOrderController.updateStock.bind(stockOrderController));
router.post("/v1/list-all",stockOrderController.getStockOrders.bind(stockOrderController));
router.get("/get/:id/:bypass_token",bypassValidation,stockOrderController.getStockOrderById.bind(stockOrderController));
router.delete("/remove/confirm-document/:id/:bypass_token",bypassValidation,stockOrderController.deleteConfirmDocument.bind(stockOrderController));
router.delete("/remove/delivered-document/:id/:bypass_token",bypassValidation,stockOrderController.deleteDeliveredDocument.bind(stockOrderController));
router.delete("/delete/:id",stockOrderController.deleteStockOrder.bind(stockOrderController));
router.patch("/update-status/:id",stockOrderController.updateStockStatus.bind(stockOrderController));
router.post("/follow-up/:id/:bypass_token?",bypassValidation,stockOrderController.addFollowUp.bind(stockOrderController));
router.delete("/follow-up/:id/:noteId",stockOrderController.deleteFollowUp.bind(stockOrderController));
export default router;