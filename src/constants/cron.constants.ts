export const DAILY = {
  MIDNIGHT:  "0 0 * * *",
  NOON:      "0 12 * * *",
  EVENING:   "0 18 * * *",
};

export const HOURLY = {
  EVERY_HOUR:   "0 * * * *",
  HALF_HOUR:    "*/30 * * * *",
  QUARTER_HOUR: "*/15 * * * *",
};

export const MORNING = {
  AM_7: "0 7 * * *",
  AM_9: "0 9 * * *",
};

export const NIGHT = {
  PM_8:  "0 20 * * *",
  PM_11: "0 23 * * *",
};

export const MINUTE = {
  EVERY_MINUTE: "*/1 * * * *",
  EVERY_5_MIN:  "*/5 * * * *",
  EVERY_10_MIN: "*/10 * * * *",
  EVERY_20_MIN: "*/20 * * * *",
  EVERY_30_MIN: "*/30 * * * *",
};