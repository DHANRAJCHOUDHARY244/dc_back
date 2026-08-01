import productController from "@controllers/product.controller";
import { Router } from "express";
const router = Router();

router.post("/create", productController.createProduct.bind(productController));
router.post("/list-all", productController.getAllProducts.bind(productController));
router.get("/categories", productController.getCategories.bind(productController));
router.get("/brands", productController.getBrands.bind(productController));

/* ── Optimised endpoints ── */
router.get("/selector/categories", productController.getCategoriesWithCounts.bind(productController));
router.get("/selector/quote-builder-config", productController.getQuoteBuilderConfig.bind(productController));
router.get("/selector/quote-builder-settings", productController.getQuoteBuilderSettings.bind(productController));
router.put("/selector/quote-builder-settings", productController.updateQuoteBuilderSettings.bind(productController));
router.get("/selector/category-config/:category", productController.getCategoryConfig.bind(productController));
router.put("/selector/category-config/:category", productController.upsertCategoryConfig.bind(productController));
router.get("/selector/brands", productController.getBrandsWithCounts.bind(productController));
router.get("/selector/products", productController.getProductsForSelector.bind(productController));

router.get("/:id", productController.getProductById.bind(productController));
router.put("/:id", productController.updateProduct.bind(productController));
router.delete("/:id", productController.deleteProduct.bind(productController));
router.post("/:id/duplicate", productController.duplicateProduct.bind(productController));

export default router;
