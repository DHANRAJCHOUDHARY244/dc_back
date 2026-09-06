/** Known manufacturer domains for favicon-based brand logos (AU solar & energy catalog). */
export type BrandLogoEntry = {
  /** Match substrings against product brand (case-insensitive). */
  names: string[];
  domain: string;
};

export const BRAND_LOGO_ENTRIES: BrandLogoEntry[] = [
  { names: ["Jinko", "Jinko Solar"], domain: "jinkosolar.com" },
  { names: ["LONGi", "Longi"], domain: "longi.com" },
  { names: ["Suntech"], domain: "suntech-power.com" },
  { names: ["Canadian Solar", "Canadian"], domain: "canadiansolar.com" },
  { names: ["Hanersun"], domain: "hanersun.com" },
  { names: ["Eging"], domain: "egingpv.com" },
  { names: ["Risen", "Risen Energy"], domain: "risenenergy.com" },
  { names: ["Trina", "Trina Solar"], domain: "trinasolar.com" },
  { names: ["JA Solar"], domain: "jasolar.com" },
  { names: ["Qcells", "Hanwha Q"], domain: "qcells.com" },
  { names: ["REC", "REC Group"], domain: "recgroup.com" },
  { names: ["Maxeon", "SunPower"], domain: "maxeon.com" },
  { names: ["Aiko"], domain: "aikosolar.com" },
  { names: ["Tongwei", "TW Solar"], domain: "tongwei.com" },
  { names: ["Astronergy"], domain: "astronergy.com" },
  { names: ["Seraphim"], domain: "seraphim-energy.com" },
  { names: ["Hyundai Energy", "Hyundai"], domain: "hyundai-energy.com" },
  { names: ["Phono"], domain: "phonosolar.com" },
  { names: ["Winaico"], domain: "winaico.com" },
  { names: ["Tindo"], domain: "tindosolar.com.au" },
  { names: ["DAS Solar"], domain: "das-solar.com" },
  { names: ["Jolywood"], domain: "jolywood-tech.com" },
  { names: ["VSUN"], domain: "vsun-solar.com" },
  { names: ["ZNShine"], domain: "znshinesolar.com" },
  { names: ["Talesun"], domain: "talesun.com" },
  { names: ["GoodWe", "Goodwe"], domain: "goodwe.com" },
  { names: ["Alpha ESS", "Alpha Ess"], domain: "alphaess.com" },
  { names: ["FoxESS", "Foxess"], domain: "foxesscloud.com" },
  { names: ["Anker", "Anker Solix"], domain: "anker.com" },
  { names: ["Tesla"], domain: "tesla.com" },
  { names: ["Sungrow"], domain: "sungrowpower.com" },
  { names: ["Fronius"], domain: "fronius.com" },
  { names: ["SMA"], domain: "sma.de" },
  { names: ["Enphase"], domain: "enphase.com" },
  { names: ["SolarEdge"], domain: "solaredge.com" },
  { names: ["Growatt"], domain: "growatt.com" },
  { names: ["Solis"], domain: "ginlong.com" },
  { names: ["Dyness"], domain: "dyness.com" },
  { names: ["SAJ"], domain: "saj-electric.com" },
  { names: ["Hyconics", "Hiconics"], domain: "hiconics.com" },
  { names: ["Rinnai"], domain: "rinnai.com.au" },
  { names: ["Midea"], domain: "midea.com" },
  { names: ["Daikin"], domain: "daikin.com.au" },
  { names: ["Samsung"], domain: "samsung.com" },
  { names: ["LG"], domain: "lg.com" },
  { names: ["Panasonic"], domain: "panasonic.com" },
  { names: ["BYD"], domain: "byd.com" },
  { names: ["Pylontech"], domain: "pylontech.com.cn" },
  { names: ["Sigenergy"], domain: "sigenergy.com" },
];

export function brandLogoUrlFromDomain(domain: string, size = 128): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

/** Resolve a persisted brand logo URL from a product brand label. */
export function resolveBrandLogoUrl(brand?: string | null): string | null {
  const raw = brand?.trim();
  if (!raw) return null;
  const q = raw.toLowerCase();

  for (const entry of BRAND_LOGO_ENTRIES) {
    for (const name of entry.names) {
      const n = name.toLowerCase();
      if (q === n || q.includes(n) || n.includes(q)) {
        return brandLogoUrlFromDomain(entry.domain);
      }
    }
  }

  return null;
}

/** Pick display image: uploaded product image, else brand logo. */
export function resolveProductDisplayImage(opts: {
  img?: string | null;
  logo_url?: string | null;
  brand?: string | null;
}): { img: string | null; logo_url: string | null } {
  const logo =
    opts.logo_url?.trim() ||
    resolveBrandLogoUrl(opts.brand) ||
    null;
  const img = opts.img?.trim() || logo || null;
  return { img, logo_url: logo };
}
