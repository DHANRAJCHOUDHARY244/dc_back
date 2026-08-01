import { Request, Response } from "express";
import { systemLogRepository } from "@repositories";
import { ReS, ReE } from "@services/generalHelper.service";
import { SERVER_ERROR_CODE, SUCCESS_CODE } from "@constants/serverCode";

class LogController {
  async getLogs(req: Request, res: Response) {
    try {
      const { page = 1, limit = 10, level, status, search } = req.query;

      const filter: any = {};
      if (level) filter.level = level;
      if (status) filter.status = status;
      if (search) {
        filter.message = { $regex: search as string, $options: "i" };
      }

      const { count, rows } = await systemLogRepository.findPaginated(filter, {
        page: Number(page),
        limit: Number(limit),
        sort: { created_at: -1 },
      });

      return ReS(res, 200, "Logs fetched successfully",{
        logs: rows,
        pagination: {
          total: count,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(count / Number(limit)),
        },
      });
    } catch (err) {
        console.error(err);
      return ReE(res, 500, "Error fetching logs");
    }
  }

  async getLogById(req: Request, res: Response) {
    try {
      const { id }:any = req.params;
      const log = await systemLogRepository.findById(Number(id));

      if (!log) return ReE(res, 404, "Log not found");

      return ReS(res, SUCCESS_CODE,"log fetch successfully", log);
    } catch (err) {
        console.error(err)
      return ReE(res, SERVER_ERROR_CODE, "Error fetching log");
    }
  }
}

export default new LogController();
