import { Request, Response, NextFunction } from "express";
import { saveLog } from "@utils/logSaver";

export const reqResLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = process.hrtime.bigint();
  const oldSend = res.send;

  let responseMessage: string | null = null;

  // Override res.send to capture ONLY message
  res.send = function (body?: any): Response {
    try {
      let parsed = body;

      // If body is a buffer or string, parse JSON
      if (typeof body === "string") {
        parsed = JSON.parse(body);
      }

      // Extract only message
      if (parsed && typeof parsed === "object" && "message" in parsed) {
        responseMessage = parsed.message;
      } else {
        responseMessage = null;
      }
    } catch {
      responseMessage = null; // If parsing fails, ignore
    }

    return oldSend.apply(res, arguments);
  };

  res.on("finish", () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    const logMeta = {
      request: {
        method: req.method,
        url: req.originalUrl,
        headers: req.headers,
        query: req.query,
        params: req.params,
        body: req.body,
        ip: req.ip,
        user: (req as any).user || null,
      },
      response: {
        statusCode: res.statusCode,
        message: responseMessage, // ⬅️ Only message stored
        headers: res.getHeaders(),
        responseTimeMs: durationMs.toFixed(2),
      },
    };

    console.log("Logging status:", res.statusCode);

    saveLog(
      "api",
      `${req.method} ${req.originalUrl}`,
      logMeta,
      res.statusCode?.toString() || "N/A"
    );
  });

  next();
};
