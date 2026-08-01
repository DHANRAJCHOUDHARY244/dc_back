import { CalenderController } from "@controllers/calender.controller";
import { Router } from "express";
const router = Router();

// Add new progress (message + optional files + optional replyToId)
router.get("/", CalenderController.getAll.bind(CalenderController));

export default router;
