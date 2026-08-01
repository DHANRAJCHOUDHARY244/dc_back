import { Router } from "express";
import expenseController from "@controllers/expense.controller";

const router = Router();

router.post("/create", expenseController.create);
router.put("/:id", expenseController.update);
router.delete("/:id", expenseController.delete);

router.post("/list", expenseController.list);
router.get("/stats", expenseController.stats);
router.get("/totals", expenseController.totals);
router.get("/chart/category", expenseController.categoryChart);
router.get("/chart/monthly", expenseController.monthlyTrend);

export default router;
