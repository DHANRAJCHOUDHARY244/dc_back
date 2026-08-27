import { Request, Response, NextFunction } from "express";

/** Pass-through only — API request bodies/headers are not persisted to MongoDB. */
export const reqResLogger = (_req: Request, _res: Response, next: NextFunction) => {
  next();
};
