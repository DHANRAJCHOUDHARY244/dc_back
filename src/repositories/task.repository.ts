import Task from "@models/task.model";
import { BaseRepository } from "./BaseRepository";

export class TaskRepository extends BaseRepository {
  constructor() {
    super(Task, true);
  }
}

export const taskRepository = new TaskRepository();
