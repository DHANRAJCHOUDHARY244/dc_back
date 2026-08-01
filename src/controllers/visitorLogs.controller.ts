import { AuthenticatedRequest } from "@constants/common.interface";
import { BAD_REQUEST_CODE, SERVER_ERROR_CODE, SUCCESS_CODE } from "@constants/serverCode";
import { visitorLogsRepository } from "@repositories";
import { ReE, ReS } from "@services/generalHelper.service";
import { Request, Response } from "express";

class VisitorLogsController {
async addOrUpdateLogs(req: Request, res: Response) {
  try {
    const { quote_id, visitorId, event, timeSpentMs, endTime, startTime, deviceInfo } = req.body;

    if (!quote_id || !visitorId || !event)
      return ReE(res, BAD_REQUEST_CODE, "Missing required fields");

    const online = event === "online";
    let logRecord:any = await visitorLogsRepository.findOne({ quote_id });

    if (!logRecord) {
      await visitorLogsRepository.create({
        quote_id,
        online,
        logs: [
          {
            visitorId,
            sessions: [{ event, timeSpentMs, endTime, startTime, deviceInfo }],
          },
        ],
      });
    } else {
      let logs = JSON.parse(JSON.stringify(logRecord.logs || []));
      let visitorLog = logs.find((l: any) => l.visitorId === visitorId);

      if (!visitorLog) {
        visitorLog = { visitorId, sessions: [] };
        logs.push(visitorLog);
      }

      visitorLog.sessions.push({ event, timeSpentMs, endTime, startTime, deviceInfo });

      await visitorLogsRepository.updateById(logRecord.id, {
        $set: { logs, online },
      });
    }

    return ReS(res, SUCCESS_CODE, "Log added successfully");
  } catch (error) {
    console.error("Error in creates/updates visitor log:", error);
    return ReE(res, SERVER_ERROR_CODE, "creates/updates visitor log");
  }
}

    async getlogsByQuoteId(req: AuthenticatedRequest, res: Response) {
        try {
            const { quote_id, limit = 10, page = 1 } = req.query;
            const parsedLimit = parseInt(limit as string, 10);
            const parsedPage = parseInt(page as string, 10);
            if (!quote_id)
                ReE(res, BAD_REQUEST_CODE, "InvalidQuoteId");
            const { count, rows: logs } = await visitorLogsRepository.findPaginated(
                { quote_id: Number(quote_id) },
                {
                  page: parsedPage,
                  limit: parsedLimit,
                  sort: { created_at: -1 },
                },
            );
            return ReS(res, SUCCESS_CODE, "logs fetched successfully", {
                currentPage: parsedPage,
                totalPages: Math.ceil(count / parsedLimit),
                limit: parsedLimit,
                totalQuotes: count,
                data: logs,
            });
        } catch (error) {
            console.error("Error in fetching visitor log getlogsByQuoteId:", error);
            return ReE(res, SERVER_ERROR_CODE, "Error in fetching visitor log");
        }
    }
}

export default new VisitorLogsController()
