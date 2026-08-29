import { DEFAULT_INSTALLATION_CHECKLIST } from "@constants/installerJob.constants";
import {
  assessmentRepository,
  installerJobRepository,
  quoteRepository,
  siteInfoRepository,
  userRepository,
} from "@repositories";

function pickAssessmentPhotos(assessment: any) {
  if (!assessment) return {};
  const photoKeys = [
    "billPhoto",
    "meterPhoto",
    "switchboardOpenPhoto",
    "switchboardClosedPhoto",
    "roofFrontPhoto",
    "roofWidePhoto",
    "shadingObjectsPhoto",
    "batteryWallPhoto",
    "batteryClearancePhoto",
    "batteryPathPhoto",
    "airconIndoorPhoto",
    "airconOutdoorPhoto",
    "airconRoutePhoto",
    "hotWaterSystemPhoto",
    "heatPumpLocationPhoto",
    "heatPumpDrainPhoto",
    "floorPlanPhoto",
    "signaturePhoto",
  ];
  const photos: Record<string, string> = {};
  for (const key of photoKeys) {
    if (assessment[key]) photos[key] = assessment[key];
  }
  return photos;
}

function extractProductsFromQuote(quote: any) {
  const items = Array.isArray(quote?.items) ? quote.items : [];
  const panels: any[] = [];
  const inverters: any[] = [];
  const batteries: any[] = [];
  const other: any[] = [];

  for (const item of items) {
    const name = String(item?.name || item?.product_name || "").toLowerCase();
    const row = {
      name: item?.name || item?.product_name || "—",
      model: item?.model || item?.description || "",
      quantity: item?.quantity ?? item?.qty ?? 1,
      attachments: item?.attachments || [],
    };
    if (name.includes("panel") || name.includes("module")) panels.push(row);
    else if (name.includes("inverter")) inverters.push(row);
    else if (name.includes("battery")) batteries.push(row);
    else other.push(row);
  }

  return { panels, inverters, batteries, other, all: items };
}

export async function buildInstallerJobPack({
  quoteId,
  assessmentId,
  siteInfo,
}: {
  quoteId: number;
  assessmentId?: number | null;
  siteInfo?: any;
}) {
  const quote: any = await quoteRepository.findById(quoteId, {
    populate: [
      { path: "customer", select: "id name email mobile_no mobile_country_code address" },
      { path: "assessment" },
    ],
    lean: true,
  });

  const assessment: any =
    quote?.assessment ||
  (assessmentId ? await assessmentRepository.findById(assessmentId, { lean: true }) : null);

  const products = extractProductsFromQuote(quote);
  const schedule = quote?.installation_schedule || {};
  const greenSketch = quote?.green_sketch || null;
  const manualAttachments = Array.isArray(quote?.manual_attachments) ? quote.manual_attachments : [];

  const customer = quote?.customer || {};
  const customerName = quote?.name || customer?.name || assessment?.fullName || "—";
  const customerPhone = quote?.mobile_no || customer?.mobile_no || assessment?.mobile || "—";
  const customerEmail = customer?.email || assessment?.email || "—";
  const installAddress =
    quote?.address || assessment?.address || schedule?.address || siteInfo?.installer_address || "—";

  return {
    generated_at: new Date().toISOString(),
    customer: {
      name: customerName,
      phone: customerPhone,
      email: customerEmail,
      address: installAddress,
    },
    site: {
      full_address: installAddress,
      postcode: quote?.postcode || assessment?.postcode || "",
      property_type: quote?.property_type || assessment?.propertyType || "",
      roof_type: assessment?.roofType || "",
      roof_condition: assessment?.roofCondition || "",
      storeys: assessment?.storeys || "",
      access_information: assessment?.siteAccess || "",
      parking_information: assessment?.parking || "",
      special_instructions: assessment?.notes || quote?.notes || "",
      photos: pickAssessmentPhotos(assessment),
    },
    system: {
      solar_system_size: assessment?.solarSystemSize || greenSketch?.systemSize || "",
      panel_brand_model: products.panels[0]?.name || "",
      panel_quantity: products.panels[0]?.quantity || assessment?.panelCount || "",
      inverter_brand_model: products.inverters[0]?.name || "",
      battery_brand_model: products.batteries[0]?.name || "",
      battery_capacity: products.batteries[0]?.model || "",
      ev_charger: products.other.find((p) => String(p.name).toLowerCase().includes("ev"))?.name || "",
      heat_pump: products.other.find((p) => String(p.name).toLowerCase().includes("heat"))?.name || "",
      other_products: products.other,
      mounting_requirements: quote?.installationType || "",
      green_sketch: greenSketch,
      quote_items: products.all,
    },
    electrical: {
      switchboard_information: assessment?.switchboardLocation || assessment?.customSwitchboardLocation || "",
      meter_information: assessment?.meterType || assessment?.customMeterType || "",
      phase: assessment?.supplyType || "",
      main_switch: assessment?.switchboardIssues || "",
      existing_solar: assessment?.existingSolar || assessment?.existingSolarDetails || quote?.existingSolar || "",
      existing_equipment: assessment?.existingAirconDetails || assessment?.existingHeatingSystem || "",
      required_electrical_work: assessment?.switchboardIssues || "",
    },
    documents: {
      site_photos: pickAssessmentPhotos(assessment),
      manual_attachments: manualAttachments,
      approved_design: greenSketch ? [greenSketch] : [],
      quote_reference: quote?.id,
      assessment_reference: assessment?.id,
    },
    booking: {
      installation_date: siteInfo?.installation_date || quote?.installationDate || schedule?.date || null,
      installation_time: siteInfo?.installation_time || schedule?.time || "",
      job_type: siteInfo?.job_type || "MIXED",
    },
    internal: {
      quote_id: quoteId,
      assessment_id: assessmentId || assessment?.id || null,
      site_info_id: siteInfo?.id || null,
    },
  };
}

function defaultChecklist() {
  return DEFAULT_INSTALLATION_CHECKLIST.map((item) => ({
    ...item,
    completed: false,
    completed_at: null,
  }));
}

async function nextJobNumber() {
  const latest: any = await installerJobRepository.findOne({}, { sort: { id: -1 }, lean: true });
  const seq = (latest?.id || 0) + 1;
  return `IJ-${String(seq).padStart(5, "0")}`;
}

export async function createOrSyncInstallerJob({
  siteInfo,
  assignedBy,
  installationTime,
  jobType,
}: {
  siteInfo: any;
  assignedBy?: number;
  installationTime?: string;
  jobType?: string;
}) {
  if (!siteInfo?.installer_id) return null;

  const jobPack = await buildInstallerJobPack({
    quoteId: siteInfo.quote_id,
    assessmentId: siteInfo.assessment_id,
    siteInfo,
  });

  const payload = {
    site_info_id: siteInfo.id,
    quote_id: siteInfo.quote_id,
    assessment_id: siteInfo.assessment_id || null,
    installer_id: siteInfo.installer_id,
    assigned_by: assignedBy || null,
    installation_date: siteInfo.installation_date,
    installation_time: installationTime || siteInfo.installation_time || "",
    job_type: jobType || siteInfo.job_type || "MIXED",
    job_pack: jobPack,
    status: "ASSIGNED",
  };

  const existing: any = await installerJobRepository.findOne(
    { site_info_id: siteInfo.id, installer_id: siteInfo.installer_id },
    { lean: true },
  );

  if (existing) {
    return installerJobRepository.updateById(existing.id, {
      $set: {
        ...payload,
        job_pack: jobPack,
      },
    });
  }

  const jobNumber = await nextJobNumber();
  return installerJobRepository.create({
    ...payload,
    job_number: jobNumber,
    checklist: defaultChecklist(),
    messages: [],
    uploads: [],
  });
}

export async function refreshInstallerJobPack(jobId: number) {
  const job: any = await installerJobRepository.findById(jobId, { lean: true });
  if (!job) return null;

  const siteInfo = job.site_info_id
    ? await siteInfoRepository.findById(job.site_info_id, { lean: true })
    : null;

  const jobPack = await buildInstallerJobPack({
    quoteId: job.quote_id,
    assessmentId: job.assessment_id,
    siteInfo,
  });

  return installerJobRepository.updateById(jobId, { $set: { job_pack: jobPack } });
}

export function checklistComplete(checklist: any[]) {
  const items = Array.isArray(checklist) ? checklist : [];
  const required = items.filter((i) => i.required);
  return required.length > 0 && required.every((i) => i.completed);
}

export async function getAllJobsDashboardStats() {
  const [active, upcoming, completed, cancelled] = await Promise.all([
    installerJobRepository.count({
      status: { $in: ["ASSIGNED", "CONFIRMED", "SCHEDULED", "ON_THE_WAY", "SITE_ARRIVED", "INSTALLATION_STARTED"] },
    }),
    installerJobRepository.count({
      status: { $in: ["ASSIGNED", "CONFIRMED", "SCHEDULED"] },
      installation_date: { $gte: new Date() },
    }),
    installerJobRepository.count({ status: { $in: ["JOB_COMPLETED", "INSTALLATION_COMPLETED", "DOCUMENTS_UPLOADED"] } }),
    installerJobRepository.count({ status: "CANCELLED" }),
  ]);
  return { active, upcoming, completed, cancelled };
}

export async function getInstallerDashboardStats(installerId: number) {
  const base = { installer_id: installerId };
  const [active, upcoming, completed, cancelled] = await Promise.all([
    installerJobRepository.count({
      ...base,
      status: { $in: ["ASSIGNED", "CONFIRMED", "SCHEDULED", "ON_THE_WAY", "SITE_ARRIVED", "INSTALLATION_STARTED"] },
    }),
    installerJobRepository.count({
      ...base,
      status: { $in: ["ASSIGNED", "CONFIRMED", "SCHEDULED"] },
      installation_date: { $gte: new Date() },
    }),
    installerJobRepository.count({ ...base, status: { $in: ["JOB_COMPLETED", "INSTALLATION_COMPLETED", "DOCUMENTS_UPLOADED"] } }),
    installerJobRepository.count({ ...base, status: "CANCELLED" }),
  ]);
  return { active, upcoming, completed, cancelled };
}

export async function getInstallerProfileHeader(installerId: number) {
  const installer: any = await userRepository.findById(installerId, {
    select: "id name email mobile_no address username",
    lean: true,
  });
  const stats = await getInstallerDashboardStats(installerId);
  return { installer, stats };
}

/** Idempotent: ensure every site_info with installer_id has a matching installer job. */
export async function syncInstallerJobsFromSiteInfo() {
  const { siteInfoRepository } = await import("@repositories");
  const rows: any[] = await siteInfoRepository.find(
    { installer_id: { $ne: null } },
    { lean: true },
  );
  let synced = 0;
  for (const siteInfo of rows) {
    try {
      const job = await createOrSyncInstallerJob({ siteInfo });
      if (job) synced += 1;
    } catch (err) {
      console.error(`Installer job sync failed for site_info ${siteInfo?.id}:`, err);
    }
  }
  return synced;
}
