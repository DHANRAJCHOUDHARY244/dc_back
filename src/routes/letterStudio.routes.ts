import { Router } from "express";
import letterStudioController from "@controllers/letterStudio.controller";

const router = Router();
router.post("/send", letterStudioController.send.bind(letterStudioController));
export default router;
