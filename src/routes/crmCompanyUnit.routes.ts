import crmCompanyUnitController from "@controllers/crmCompanyUnit.controller";
import { Router } from "express";

const router = Router();

router.get("/list", crmCompanyUnitController.listForSelector.bind(crmCompanyUnitController));
router.get("/public/branding", crmCompanyUnitController.getPublicBranding.bind(crmCompanyUnitController));
router.get("/:id", crmCompanyUnitController.getById.bind(crmCompanyUnitController));
router.put("/:id", crmCompanyUnitController.updateById.bind(crmCompanyUnitController));

export default router;
