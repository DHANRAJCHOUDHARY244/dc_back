import { Router } from "express";
import taskController from "@controllers/task.controller";

const router = Router();

router.post("/create", taskController.createTask.bind(taskController));
router.post("/list", taskController.getTasks.bind(taskController));
router.get("/detail/:id", taskController.getTaskById.bind(taskController));
router.put("/update/:id", taskController.updateTask.bind(taskController));
router.put("/status/:id", taskController.taskStatus.bind(taskController));
router.delete("/:id", taskController.deleteTask.bind(taskController));
router.post("/user-tasks",taskController.getTasksByLoggedInUser.bind(taskController));
export default router;
