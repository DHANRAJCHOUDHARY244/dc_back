/**
 * Mongo API/system log persistence is disabled.
 * HTTP traffic is covered by morgan; app logs go to pino/console only.
 */
export const setDbReady = (_ready: boolean) => {
  /* no-op */
};

export const saveLog = async (
  _level: string,
  _message: string,
  _meta: any = {},
  _status = "N/A",
) => {
  /* intentionally does not write to MongoDB */
};

export const deleteOldLogsCron = async () => {
  /* no-op — API/system logs are no longer stored */
};
