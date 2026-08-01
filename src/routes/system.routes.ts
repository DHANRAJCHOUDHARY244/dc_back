import { Router } from "express";
import { SystemController } from "@controllers/system.controller";

const router = Router();
const controller = new SystemController();

router.get("/advanced-stats", controller.getUltraSystemStats.bind(controller));

export default router;
