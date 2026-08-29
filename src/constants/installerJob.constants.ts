export const INSTALLER_JOB_STATUSES = [
  "ASSIGNED",
  "CONFIRMED",
  "SCHEDULED",
  "ON_THE_WAY",
  "SITE_ARRIVED",
  "INSTALLATION_STARTED",
  "INSTALLATION_COMPLETED",
  "DOCUMENTS_UPLOADED",
  "JOB_COMPLETED",
  "CANCELLED",
] as const;

export type InstallerJobStatus = (typeof INSTALLER_JOB_STATUSES)[number];

export const INSTALLER_JOB_TYPES = [
  "SOLAR",
  "BATTERY",
  "EV_CHARGER",
  "HEAT_PUMP",
  "AIRCON",
  "DUCTED",
  "MIXED",
  "OTHER",
] as const;

export type InstallerJobType = (typeof INSTALLER_JOB_TYPES)[number];

export const INSTALLER_AVAILABILITY_STATUSES = [
  "AVAILABLE",
  "BOOKED",
  "UNAVAILABLE",
  "LEAVE",
  "BLOCKED",
] as const;

export type InstallerAvailabilityStatus = (typeof INSTALLER_AVAILABILITY_STATUSES)[number];

export const DEFAULT_INSTALLATION_CHECKLIST = [
  { key: "site_arrival", label: "Site arrival confirmed", required: true },
  { key: "location_checked", label: "Installation location checked", required: true },
  { key: "panels_installed", label: "Panels installed", required: false },
  { key: "inverter_installed", label: "Inverter installed", required: false },
  { key: "battery_installed", label: "Battery installed", required: false },
  { key: "electrical_completed", label: "Electrical work completed", required: true },
  { key: "system_tested", label: "System tested", required: true },
  { key: "photos_uploaded", label: "Photos uploaded", required: true },
  { key: "serials_uploaded", label: "Serial numbers uploaded", required: true },
  { key: "compliance_completed", label: "Compliance documents completed", required: true },
  { key: "installation_completed", label: "Installation completed", required: true },
];
