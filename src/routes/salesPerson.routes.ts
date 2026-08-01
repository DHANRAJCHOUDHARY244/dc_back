import express from "express";
import salesPersonController from "@controllers/salesPerson.controller";

const router = express.Router();

router.post("/add-new", salesPersonController.addNew.bind(salesPersonController));
router.get("/list-all", salesPersonController.listSalesPeron.bind(salesPersonController));
router.get("/search", salesPersonController.searchSalesPerons.bind(salesPersonController));
router.get("/metrics-analysis", salesPersonController.getMetricsAnalysis.bind(salesPersonController));
router.get("/:userId", salesPersonController.getsalesPeron.bind(salesPersonController));
router.delete("/delete", salesPersonController.deletesalesPeron.bind(salesPersonController));
router.post("/update-profile-image/:userId", salesPersonController.updatesalesPeronProfileImage.bind(salesPersonController));
router.post("/update-password",salesPersonController.updatesalesPeronPassword.bind(salesPersonController));
router.post("/update-sales-person/:userId",salesPersonController.updatesalesPeronDetails.bind(salesPersonController));
export default router;