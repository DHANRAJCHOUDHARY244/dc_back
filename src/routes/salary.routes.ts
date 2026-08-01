
import salaryController from '@controllers/salary.controller';
import express  from 'express';
const router = express.Router();

router.post("/save-update-bank-details",salaryController.saveBankDetails.bind(salaryController));
router.post("/add",salaryController.createSalary.bind(salaryController));
router.post("/list-all",salaryController.getAllSalaries.bind(salaryController));
router.get("/:id",salaryController.getSalaryById.bind(salaryController));
router.get("/my-salaries",salaryController.getMySalaries.bind(salaryController));
router.put("/:id",salaryController.updateSalary.bind(salaryController));
router.delete("/:id",salaryController.deleteSalary.bind(salaryController));
export default router;