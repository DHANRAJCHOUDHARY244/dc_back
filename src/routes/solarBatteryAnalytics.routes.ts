import express from "express";
import solarBatteryAnalyticsController from "@controllers/solarBatteryAnalytics.controller";

const router = express.Router();

router.post("/analyze", solarBatteryAnalyticsController.analyze.bind(solarBatteryAnalyticsController));
router.get("/bills", solarBatteryAnalyticsController.listBills.bind(solarBatteryAnalyticsController));

export default router;
