import slugify from "slugify";
import {
  calculatorBrandRepository,
  calculatorCategoryRepository,
  calculatorExtraRepository,
  calculatorSettingsRepository,
} from "@repositories";

const SEED_CATEGORIES: {
  name: string;
  rebate_options: string[];
  size_fields: string[];
  brands: string[];
}[] = [
  {
    name: "Solar",
    rebate_options: ["solar_vic", "interest_free_loan", "stc"],
    size_fields: ["size_kw"],
    brands: ["Jinko Solar", "Hanersun", "Logi Pannels", "Canadian Solar", "Trina", "Eging", "Ja Solar", "Risen"],
  },
  {
    name: "Battery",
    rebate_options: ["bstc"],
    size_fields: ["battery_kwh", "inverter_kw"],
    brands: [
      "Foxess", "Hyxi", "Goodwe", "Neovolt", "Pylontech", "Sigenergy", "Sofar Solar",
      "Anker Solix", "Alpha Ess Smile", "Dyness", "Saj Battery", "Sungrow", "Fronius",
    ],
  },
  {
    name: "Inverter",
    rebate_options: ["stc"],
    size_fields: ["inverter_kw"],
    brands: ["Foxess", "Goodwe", "Sofar Solar", "Anker Solix", "Sungrow", "Fronius", "Sigenergy"],
  },
  {
    name: "Combo",
    rebate_options: ["stc", "bstc", "solar_vic"],
    size_fields: ["size_kw", "battery_kwh"],
    brands: ["Foxess", "Goodwe", "Sofar Solar", "Sigenergy", "Sungrow"],
  },
  {
    name: "Heat pump",
    rebate_options: ["solar_vic", "stc", "veec"],
    size_fields: ["capacity"],
    brands: ["Media", "Aquatech", "Emerald", "Istore", "Powerbay", "Aether"],
  },
  {
    name: "Aircon",
    rebate_options: ["veec"],
    size_fields: ["capacity"],
    brands: ["Rinnai", "Media"],
  },
  { name: "Split", rebate_options: ["veec"], size_fields: ["capacity"], brands: ["Rinnai", "Media"] },
  { name: "VRF", rebate_options: ["veec"], size_fields: ["capacity"], brands: ["Rinnai", "Media"] },
  { name: "Ducted", rebate_options: ["veec"], size_fields: ["capacity"], brands: ["Rinnai", "Media"] },
  {
    name: "EV Charger",
    rebate_options: [],
    size_fields: ["capacity"],
    brands: ["Foxess", "Goodwe", "Anker Solix", "Tesla", "Zappi", "Solar Edge"],
  },
  {
    name: "Water Filtration",
    rebate_options: [],
    size_fields: ["capacity"],
    brands: ["Puretec", "Aquasana", "BWT", "Brita", "Stefani"],
  },
];

const SEED_EXTRAS = [
  "Canopy",
  "Bollard",
  "Smoke alarm",
  "Cement sheet",
  "Smart metre",
  "Tilt frames",
  "EV charger cable run",
  "Consumption monitor",
];

function slug(name: string) {
  return slugify(name, { lower: true, strict: true });
}

export async function ensureCalculatorCatalogSeeded() {
  const catCount = await calculatorCategoryRepository.count({});
  if (catCount > 0) return;

  let sort = 0;
  for (const cat of SEED_CATEGORIES) {
    const category = await calculatorCategoryRepository.create({
      name: cat.name,
      slug: slug(cat.name),
      rebate_options: cat.rebate_options,
      size_fields: cat.size_fields,
      sort_order: sort++,
      active: true,
    });

    let brandSort = 0;
    for (const brandName of cat.brands) {
      await calculatorBrandRepository.create({
        category_id: category.id,
        name: brandName,
        sort_order: brandSort++,
        active: true,
      });
    }
  }

  let extraSort = 0;
  for (const label of SEED_EXTRAS) {
    await calculatorExtraRepository.create({
      key: slug(label),
      label,
      sort_order: extraSort++,
      active: true,
      prices: { vic: 0, nsw: 0, act: 0 },
    });
  }

  const settings = await calculatorSettingsRepository.findOne({ id: 1 });
  if (!settings) {
    await calculatorSettingsRepository.create({ id: 1 });
  }
}
