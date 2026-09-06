import fs from "fs/promises";
import path from "path";
import { getGeminiClient, isGeminiConfigured } from "@assistant/services/gemini/gemini.client";
import { getAssistantConfig } from "@assistant/services/assistant.config.service";
import { extractTextFromKnowledgeFile } from "@assistant/services/rag/documentParser.service";

export type SolarBatteryInputsPayload = {
  customer: {
    customerName: string;
    address: string;
    suburb: string;
    state: string;
    postcode: string;
    email: string;
    phone: string;
  };
  bill: {
    latestBillAmount: number;
    billingDays: number;
    dailyUsageKwh: number;
    peakUsageKwhDay: number;
    offPeakUsageKwhDay: number;
    solarExportKwhDay: number;
    peakRate: number;
    offPeakRate: number;
    feedInRate: number;
    annualBillCost: number;
    annualElectricityCost: number;
    solarGrade: "A+" | "A" | "B" | "C" | "D";
    retailer: string;
    nmi: string;
  };
  system: {
    solarKw: number;
    batteryKwh: number;
    evChargerKw: number;
    systemCost: number;
    rebates: number;
    annualGenerationKwh: number;
    panelBrand: string;
    inverterBrand: string;
    batteryBrand: string;
    chargerBrand: string;
    considerEvFuture: boolean;
    evModel: string;
    evPlanYear: string;
  };
};

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const PDF_EXTS = new Set([".pdf"]);

const SYSTEM_PROMPT = `You extract Australian electricity bill data into JSON with keys: customer, bill, system.

CRITICAL accuracy rules:
1. The uploaded bill (PDF/photo text or image) is the ONLY source of truth for customer + bill fields.
2. Copy values EXACTLY as printed (names, NMI, address, retailer, kWh, $/kWh, $ amounts). Do not invent, guess, or use example customers.
3. NEVER use placeholder/demo names (e.g. Hutchison, Fyansford, Origin demo data).
4. If a field is not clearly on the bill, use "" for strings and 0 for numbers. Do NOT estimate missing identity fields (name, NMI, address, retailer).
5. Only derive annualBillCost as latestBillAmount × (365/billingDays) when latestBillAmount is clearly on the bill and annual is missing.
6. Rates must be decimals in $/kWh (e.g. 40c → 0.40). Usage in kWh.
7. NMI is usually 10–11 digits — copy exactly; if unsure use "".
8. system: only fill if solar/battery sizes appear on the bill; otherwise use zeros and empty brand strings (we size systems later).
9. solarGrade: use "B" unless bill states a grade.
10. Return ONLY valid JSON. No markdown, no commentary.`;

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ""): string {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function grade(v: unknown): SolarBatteryInputsPayload["bill"]["solarGrade"] {
  const g = String(v || "B").toUpperCase();
  if (g === "A+") return "A+";
  if (g === "A" || g === "B" || g === "C" || g === "D") return g as SolarBatteryInputsPayload["bill"]["solarGrade"];
  return "B";
}

/** Reject known demo contamination from earlier UI defaults. */
function scrubDemoContamination(raw: any): any {
  const demoNames = /hutchison|fyansford|steven\s*&\s*andrea/i;
  const customer = { ...(raw?.customer || {}) };
  const bill = { ...(raw?.bill || {}) };
  if (demoNames.test(String(customer.customerName || ""))) customer.customerName = "";
  if (demoNames.test(String(customer.suburb || ""))) customer.suburb = "";
  if (demoNames.test(String(customer.address || ""))) customer.address = "";
  if (String(bill.nmi || "") === "1480182035") bill.nmi = "";
  if (/origin energy/i.test(String(bill.retailer || "")) && Number(bill.latestBillAmount) === 436) {
    bill.retailer = "";
  }
  return { ...raw, customer, bill };
}

export function normalizeSolarBatteryInputs(
  raw: any,
  warnings: string[] = [],
): SolarBatteryInputsPayload {
  raw = scrubDemoContamination(raw);
  const customer = raw?.customer || {};
  const bill = raw?.bill || {};
  const system = raw?.system || {};

  const latestBillAmount = num(bill.latestBillAmount, 0);
  const billingDays = num(bill.billingDays, 30) || 30;
  let annualBillCost = num(bill.annualBillCost, 0);
  if (!annualBillCost && latestBillAmount > 0) {
    annualBillCost = Math.round(latestBillAmount * (365 / billingDays));
    warnings.push("annualBillCost derived from bill amount × periods/year");
  }
  let annualElectricityCost = num(bill.annualElectricityCost, 0);
  if (!annualElectricityCost && annualBillCost > 0) {
    annualElectricityCost = annualBillCost;
  }

  const dailyUsageKwh = num(bill.dailyUsageKwh, 0);
  const peakRate = num(bill.peakRate, 0);
  const offPeakRate = num(bill.offPeakRate, 0);
  const feedInRate = num(bill.feedInRate, 0);

  const solarKw = num(system.solarKw, 0);
  let annualGenerationKwh = num(system.annualGenerationKwh, 0);
  if (!annualGenerationKwh && solarKw > 0) {
    annualGenerationKwh = Math.round(solarKw * 1400);
  }

  const stateRaw = str(customer.state, "");
  const state =
    stateRaw.length === 2 || stateRaw.length === 3
      ? stateRaw.toUpperCase()
      : stateRaw
        ? stateRaw.toUpperCase().slice(0, 3)
        : "";

  return {
    customer: {
      customerName: str(customer.customerName),
      address: str(customer.address),
      suburb: str(customer.suburb),
      state: state || "VIC",
      postcode: str(customer.postcode),
      email: str(customer.email),
      phone: str(customer.phone),
    },
    bill: {
      latestBillAmount,
      billingDays,
      dailyUsageKwh,
      peakUsageKwhDay: num(bill.peakUsageKwhDay, 0),
      offPeakUsageKwhDay: num(bill.offPeakUsageKwhDay, 0),
      solarExportKwhDay: num(bill.solarExportKwhDay, 0),
      peakRate,
      offPeakRate,
      feedInRate,
      annualBillCost,
      annualElectricityCost,
      solarGrade: grade(bill.solarGrade),
      retailer: str(bill.retailer),
      nmi: str(bill.nmi),
    },
    system: {
      solarKw,
      batteryKwh: num(system.batteryKwh, 0),
      evChargerKw: num(system.evChargerKw, 0),
      systemCost: num(system.systemCost, 0),
      rebates: num(system.rebates, 0),
      annualGenerationKwh,
      panelBrand: str(system.panelBrand),
      inverterBrand: str(system.inverterBrand),
      batteryBrand: str(system.batteryBrand),
      chargerBrand: str(system.chargerBrand),
      considerEvFuture: Boolean(system.considerEvFuture),
      evModel: str(system.evModel),
      evPlanYear: str(system.evPlanYear),
    },
  };
}

function parseJsonLoose(text: string): any {
  const trimmed = String(text || "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("AI returned invalid JSON");
  }
}

async function tryExtractPdfText(filePath: string, fileName: string): Promise<string> {
  try {
    const { text } = await extractTextFromKnowledgeFile(filePath, fileName);
    return String(text || "").trim();
  } catch {
    // Scanned / image-only PDFs often have no text layer — fall back to Gemini vision.
    return "";
  }
}

export async function analyzeSolarBatteryBill(opts: {
  filePath?: string;
  fileName?: string;
  mimeType?: string;
  manualJson?: string | Record<string, unknown> | null;
  manualNotes?: string | null;
}): Promise<{
  inputs: SolarBatteryInputsPayload;
  extracted: {
    nmi: string;
    retailer: string;
    latestBillAmount: number;
    dailyUsageKwh: number;
    customerName: string;
    address?: string;
    suburb?: string;
    state?: string;
    postcode?: string;
    peakRate?: number;
    offPeakRate?: number;
    feedInRate?: number;
    annualBillCost?: number;
  };
  warnings: string[];
}> {
  if (!(await isGeminiConfigured())) {
    throw new Error("Google AI API key is not configured in CRM settings");
  }

  const warnings: string[] = [];
  const hasFile = Boolean(opts.filePath);
  const manualObj =
    typeof opts.manualJson === "string"
      ? (() => {
          try {
            return opts.manualJson ? JSON.parse(opts.manualJson) : null;
          } catch {
            warnings.push("manual JSON could not be parsed; treating as notes");
            return null;
          }
        })()
      : opts.manualJson || null;
  const manualNotes = String(opts.manualNotes || "").trim();

  if (!hasFile && !manualObj && !manualNotes) {
    throw new Error("Upload a bill file or provide manual customer/bill details");
  }

  const config = await getAssistantConfig();
  const genAI = await getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: config.model || process.env.GEMINI_MODEL || "gemini-2.0-flash",
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.05,
      maxOutputTokens: Math.max(2048, Number(config.max_output_tokens) || 4096),
      responseMimeType: "application/json",
    },
  });

  const schemaHint = `{
  "customer": { "customerName": "", "address": "", "suburb": "", "state": "VIC", "postcode": "", "email": "", "phone": "" },
  "bill": {
    "latestBillAmount": 0, "billingDays": 30, "dailyUsageKwh": 0,
    "peakUsageKwhDay": 0, "offPeakUsageKwhDay": 0, "solarExportKwhDay": 0,
    "peakRate": 0, "offPeakRate": 0, "feedInRate": 0,
    "annualBillCost": 0, "annualElectricityCost": 0,
    "solarGrade": "B", "retailer": "", "nmi": ""
  },
  "system": {
    "solarKw": 0, "batteryKwh": 0, "evChargerKw": 0,
    "systemCost": 0, "rebates": 0, "annualGenerationKwh": 0,
    "panelBrand": "", "inverterBrand": "", "batteryBrand": "", "chargerBrand": "",
    "considerEvFuture": false, "evModel": "", "evPlanYear": ""
  }
}`;

  const parts: any[] = [];
  let ext = path.extname(opts.fileName || opts.filePath || "").toLowerCase();
  const mimeHint = String(opts.mimeType || "").toLowerCase();
  if (!ext || ext === ".") {
    if (mimeHint.includes("pdf")) ext = ".pdf";
    else if (mimeHint.includes("png")) ext = ".png";
    else if (mimeHint.includes("webp")) ext = ".webp";
    else if (mimeHint.includes("gif")) ext = ".gif";
    else if (mimeHint.includes("jpeg") || mimeHint.includes("jpg")) ext = ".jpg";
  }

  if (hasFile && opts.filePath) {
    if (IMAGE_EXTS.has(ext) || mimeHint.startsWith("image/")) {
      const buf = await fs.readFile(opts.filePath);
      const mime =
        (mimeHint.startsWith("image/") ? opts.mimeType : null) ||
        (ext === ".png"
          ? "image/png"
          : ext === ".webp"
            ? "image/webp"
            : ext === ".gif"
              ? "image/gif"
              : "image/jpeg");
      parts.push({
        inlineData: {
          mimeType: mime,
          data: buf.toString("base64"),
        },
      });
      parts.push({
        text: "This is a photo/image of an electricity bill. OCR every visible field (customer, NMI, address, usage, rates, amounts) into the JSON schema.",
      });
      warnings.push("Used photo/image OCR path");
    } else if (PDF_EXTS.has(ext) || mimeHint.includes("pdf")) {
      const text = await tryExtractPdfText(opts.filePath, opts.fileName || "bill.pdf");
      const buf = await fs.readFile(opts.filePath);
      const hasText = text.length >= 40;

      // Text-based PDF: use extracted text (fast + accurate).
      if (hasText) {
        parts.push({
          text: `Electricity bill PDF text layer:\n\n${text.slice(0, 28000)}\n\nExtract into the JSON schema.`,
        });
        warnings.push("Used PDF text extraction");
      }

      // Always also attach PDF so scanned / mixed PDFs (photo pages + text) still work.
      parts.push({
        inlineData: {
          mimeType: "application/pdf",
          data: buf.toString("base64"),
        },
      });
      parts.push({
        text: hasText
          ? "Also read the attached PDF visually for any fields missing from the text layer (tables, stamps, photo pages). Merge into the JSON schema."
          : "This PDF has little or no text layer (scan/photo PDF). OCR the attached PDF and extract every customer and bill field into the JSON schema.",
      });

      if (!hasText) {
        warnings.push("PDF had no text layer — used Gemini vision/OCR");
      } else {
        warnings.push("Also attached PDF for vision fallback (photo+text pages)");
      }
    } else {
      throw new Error("Unsupported file type. Upload a photo (PNG/JPG/WEBP) or PDF (text or scan).");
    }
  }

  if (manualObj || manualNotes) {
    const hasBillFile = hasFile;
    parts.push({
      text: hasBillFile
        ? `Optional staff notes only (do NOT override bill identity/usage/rates unless the note explicitly corrects a misread):\n${
            manualNotes ? `Notes: ${manualNotes}` : ""
          }\n${
            manualObj
              ? `(Ignore any prefilled form JSON that conflicts with the bill.)\n`
              : ""
          }Extract from the bill into the JSON schema.`
        : `Staff-entered details (no bill file — use these as the source):\n${
            manualObj ? JSON.stringify(manualObj) : ""
          }\n${manualNotes ? `Notes: ${manualNotes}` : ""}\n\nComplete the JSON schema. Leave unknown fields empty/0.`,
    });
  }

  parts.push({ text: `Required JSON schema:\n${schemaHint}` });

  const result = await model.generateContent(parts);
  const rawText = result.response.text();
  const parsed = parseJsonLoose(rawText);
  const inputs = normalizeSolarBatteryInputs(parsed, warnings);

  return {
    inputs,
    extracted: {
      nmi: inputs.bill.nmi,
      retailer: inputs.bill.retailer,
      latestBillAmount: inputs.bill.latestBillAmount,
      dailyUsageKwh: inputs.bill.dailyUsageKwh,
      customerName: inputs.customer.customerName,
      address: inputs.customer.address,
      suburb: inputs.customer.suburb,
      state: inputs.customer.state,
      postcode: inputs.customer.postcode,
      peakRate: inputs.bill.peakRate,
      offPeakRate: inputs.bill.offPeakRate,
      feedInRate: inputs.bill.feedInRate,
      annualBillCost: inputs.bill.annualBillCost,
    },
    warnings,
  };
}
