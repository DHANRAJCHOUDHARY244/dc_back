import companyController from "@controllers/company.controller";
import { Router } from "express";

const router = Router();

router.post("/create",companyController.createCompany.bind(companyController));
router.put("/:id",companyController.updateCompany.bind(companyController));
router.post("/list-all",companyController.getCompanies.bind(companyController));
router.get("/:id",companyController.getCompanyById.bind(companyController));
router.delete("/:id",companyController.deleteCompany.bind(companyController));

export default router;