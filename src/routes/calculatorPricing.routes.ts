import { Router } from "express";
import calculatorPricingController from "@controllers/calculatorPricing.controller";

const router = Router();

router.get("/catalog", calculatorPricingController.getCatalog.bind(calculatorPricingController));
router.post("/estimate", calculatorPricingController.estimate.bind(calculatorPricingController));

router.get("/settings", calculatorPricingController.getSettings.bind(calculatorPricingController));
router.put("/settings", calculatorPricingController.updateSettings.bind(calculatorPricingController));

router.get("/categories", calculatorPricingController.listCategories.bind(calculatorPricingController));
router.post("/categories", calculatorPricingController.createCategory.bind(calculatorPricingController));
router.put("/categories/:id", calculatorPricingController.updateCategory.bind(calculatorPricingController));
router.delete("/categories/:id", calculatorPricingController.deleteCategory.bind(calculatorPricingController));

router.get("/brands", calculatorPricingController.listBrands.bind(calculatorPricingController));
router.post("/brands", calculatorPricingController.createBrand.bind(calculatorPricingController));
router.put("/brands/:id", calculatorPricingController.updateBrand.bind(calculatorPricingController));
router.delete("/brands/:id", calculatorPricingController.deleteBrand.bind(calculatorPricingController));

router.get("/products", calculatorPricingController.listProducts.bind(calculatorPricingController));
router.post("/products", calculatorPricingController.createProduct.bind(calculatorPricingController));
router.put("/products/:id", calculatorPricingController.updateProduct.bind(calculatorPricingController));
router.delete("/products/:id", calculatorPricingController.deleteProduct.bind(calculatorPricingController));

router.get("/extras", calculatorPricingController.listExtras.bind(calculatorPricingController));
router.post("/extras", calculatorPricingController.createExtra.bind(calculatorPricingController));
router.put("/extras/:id", calculatorPricingController.updateExtra.bind(calculatorPricingController));
router.delete("/extras/:id", calculatorPricingController.deleteExtra.bind(calculatorPricingController));

export default router;
