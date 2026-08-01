import productItemsController from "@controllers/productItems.controller";
import { Router } from "express";
const router = Router();

router.post("/create",productItemsController.createProduct.bind(productItemsController));
router.post("/list-all",productItemsController.getAllProducts.bind(productItemsController));
router.get("/:id",productItemsController.getProductById.bind(productItemsController));
router.put("/:id",productItemsController.updateProduct.bind(productItemsController));
router.delete("/:id",productItemsController.deleteProduct.bind(productItemsController));

export default router;