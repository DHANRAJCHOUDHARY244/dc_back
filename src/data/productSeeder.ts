import { productRepository } from "@repositories";

/* ================================================================
   PRODUCT SEED DATA
   Each product maps to the DB Product model:
   - name, slug, category, brand, description, img, pdf
   - specifications: [{key, value}]
   - tags: string[]
   - variants: [{id, capacity, phase, rebate, price, additional:{stack}}]
   ================================================================ */

interface VariantRow {
	id: string;
	capacity: string;
	phase: string;
	rebate: number;
	price: number;
	additional: { stack: string; inverter: string };
}

interface SeedProduct {
	name: string;
	category: string;
	brand: string;
	description: string;
	img: string;
	pdf: string;
	specifications: { key: string; value: string }[];
	tags: string[];
	variants: VariantRow[];
}

/* ── Helper: build variant rows from table data ── */
function buildVariants(
	brand: string,
	rows: { size: string; stack: string; inverter: string; rebate: number; price: number }[],
): VariantRow[] {
	return rows.map((r, i) => ({
		id: `${brand.toLowerCase().replace(/\s+/g, "-")}-${i + 1}`,
		capacity: r.size,
		phase: r.inverter,
		rebate: r.rebate,
		price: r.price,
		additional: { stack: r.stack, inverter: r.inverter },
	}));
}

/* ================================================================
   BATTERY PRODUCTS WITH FULL VARIANT PRICING
   ================================================================ */
const batteryProducts: SeedProduct[] = [
	/* ── Anker Solix ── */
	{
		name: "Anker Solix Battery System",
		category: "BATTERY",
		brand: "Anker Solix",
		description: "Supply and install - Anker Solix Battery System. Smart meter, battery base, inverter, backup included.",
		img: "",
		pdf: "",
		specifications: [
			{ key: "Warranty", value: "10 year product warranty" },
			{ key: "Workmanship", value: "5 year workmanship warranty" },
		],
		tags: ["battery", "anker", "solix", "residential"],
		variants: buildVariants("anker-solix", [
			{ size: "5kW", stack: "Single", inverter: "1P-5kW", rebate: 1596, price: 5397 },
			{ size: "10kW", stack: "Single", inverter: "1P-5kW", rebate: 3192, price: 6523 },
			{ size: "15kW", stack: "Single", inverter: "1P-5kW", rebate: 4788, price: 7648 },
			{ size: "20kW", stack: "Single", inverter: "1P-5kW", rebate: 6384, price: 8774 },
			{ size: "25kW", stack: "Single", inverter: "1P-5kW", rebate: 7980, price: 9900 },
			{ size: "5kW", stack: "Single", inverter: "3P-8kW", rebate: 1596, price: 6701 },
			{ size: "10kW", stack: "Single", inverter: "3P-8kW", rebate: 3192, price: 7827 },
			{ size: "15kW", stack: "Single", inverter: "3P-8kW", rebate: 4788, price: 8953 },
			{ size: "20kW", stack: "Single", inverter: "3P-8kW", rebate: 6384, price: 10078 },
			{ size: "25kW", stack: "Single", inverter: "3P-8kW", rebate: 7980, price: 11204 },
		]),
	},

	/* ── GoodWe ESA ── */
	{
		name: "GoodWe ESA Battery System",
		category: "BATTERY",
		brand: "GoodWe",
		description: "Supply and install - GoodWe ESA Battery System. Smart meter, battery base, inverter, backup included.",
		img: "/products/battery/goodwe/goodwe.png",
		pdf: "/products/battery/goodwe/goodwe.pdf",
		specifications: [
			{ key: "Warranty", value: "10 year product warranty" },
			{ key: "Workmanship", value: "5 year workmanship warranty" },
		],
		tags: ["battery", "goodwe", "esa", "residential"],
		variants: buildVariants("goodwe-esa", [
			{ size: "8kW", stack: "Single", inverter: "1P-10kW", rebate: 2554, price: 5754 },
			{ size: "16kW", stack: "Single", inverter: "1P-10kW", rebate: 5107, price: 6182 },
			{ size: "24kW", stack: "Single", inverter: "1P-10kW", rebate: 7661, price: 6609 },
			{ size: "32kW", stack: "Single", inverter: "1P-10kW", rebate: 10214, price: 7447 },
			{ size: "40kW", stack: "Single", inverter: "1P-10kW", rebate: 12768, price: 7874 },
			{ size: "48kW", stack: "Single", inverter: "1P-10kW", rebate: 15322, price: 8800 },
			{ size: "8kW", stack: "Single", inverter: "3P-10kW", rebate: 2554, price: 6348 },
			{ size: "16kW", stack: "Single", inverter: "3P-10kW", rebate: 5107, price: 6776 },
			{ size: "24kW", stack: "Single", inverter: "3P-10kW", rebate: 7661, price: 7203 },
			{ size: "32kW", stack: "Single", inverter: "3P-10kW", rebate: 10214, price: 8041 },
			{ size: "40kW", stack: "Single", inverter: "3P-10kW", rebate: 12768, price: 8468 },
			{ size: "48kW", stack: "Single", inverter: "3P-10kW", rebate: 15322, price: 9394 },
		]),
	},

	/* ── GoodWe Lynx 3.2kW ── */
	{
		name: "GoodWe Lynx 3.2kW Battery System",
		category: "BATTERY",
		brand: "GoodWe",
		description: "Supply and install - GoodWe Lynx 3.2kW Battery System. Smart meter, battery base, inverter, backup included.",
		img: "/products/battery/goodwe/goodwe.png",
		pdf: "/products/battery/goodwe/goodwe.pdf",
		specifications: [
			{ key: "Warranty", value: "10 year product warranty" },
			{ key: "Workmanship", value: "5 year workmanship warranty" },
		],
		tags: ["battery", "goodwe", "lynx", "residential"],
		variants: buildVariants("goodwe-lynx", [
			{ size: "3.2kW", stack: "Single", inverter: "1P-10kW", rebate: 1021, price: 6161 },
			{ size: "6.4kW", stack: "Single", inverter: "1P-10kW", rebate: 2043, price: 6279 },
			{ size: "9.6kW", stack: "Single", inverter: "1P-10kW", rebate: 3064, price: 6398 },
			{ size: "12.8kW", stack: "Single", inverter: "1P-10kW", rebate: 4086, price: 6516 },
			{ size: "16.0kW", stack: "Single", inverter: "1P-10kW", rebate: 5107, price: 5495 },
			{ size: "19.2kW", stack: "Single", inverter: "1P-10kW", rebate: 6129, price: 5613 },
			{ size: "22.4kW", stack: "Single", inverter: "1P-10kW", rebate: 7150, price: 5732 },
			{ size: "25.6kW", stack: "Single", inverter: "1P-10kW", rebate: 8172, price: 5850 },
			{ size: "28.8kW", stack: "Double", inverter: "1P-10kW", rebate: 9193, price: 7277 },
			{ size: "32.0kW", stack: "Double", inverter: "1P-10kW", rebate: 10214, price: 6256 },
			{ size: "35.2kW", stack: "Double", inverter: "1P-10kW", rebate: 11236, price: 6374 },
			{ size: "38.4kW", stack: "Double", inverter: "1P-10kW", rebate: 12257, price: 6493 },
			{ size: "41.6kW", stack: "Double", inverter: "1P-10kW", rebate: 13279, price: 6571 },
			{ size: "44.8kW", stack: "Double", inverter: "1P-10kW", rebate: 14301, price: 6689 },
			{ size: "48.0kW", stack: "Double", inverter: "1P-10kW", rebate: 15322, price: 6168 },
			{ size: "51.2kW", stack: "Double", inverter: "1P-10kW", rebate: 16343, price: 6287 },
			{ size: "3.2kW", stack: "Single", inverter: "3P-10kW", rebate: 1021, price: 6755 },
			{ size: "6.4kW", stack: "Single", inverter: "3P-10kW", rebate: 2043, price: 6873 },
			{ size: "9.6kW", stack: "Single", inverter: "3P-10kW", rebate: 3064, price: 6992 },
			{ size: "12.8kW", stack: "Single", inverter: "3P-10kW", rebate: 4086, price: 7110 },
			{ size: "16.0kW", stack: "Single", inverter: "3P-10kW", rebate: 5107, price: 6089 },
			{ size: "19.2kW", stack: "Single", inverter: "3P-10kW", rebate: 6129, price: 6207 },
			{ size: "22.4kW", stack: "Single", inverter: "3P-10kW", rebate: 7150, price: 6326 },
			{ size: "25.6kW", stack: "Single", inverter: "3P-10kW", rebate: 8172, price: 6444 },
			{ size: "28.8kW", stack: "Double", inverter: "3P-10kW", rebate: 9193, price: 7871 },
			{ size: "32.0kW", stack: "Double", inverter: "3P-10kW", rebate: 10214, price: 6850 },
			{ size: "35.2kW", stack: "Double", inverter: "3P-10kW", rebate: 11236, price: 6968 },
			{ size: "38.4kW", stack: "Double", inverter: "3P-10kW", rebate: 12257, price: 7087 },
			{ size: "41.6kW", stack: "Double", inverter: "3P-10kW", rebate: 13279, price: 7165 },
			{ size: "44.8kW", stack: "Double", inverter: "3P-10kW", rebate: 14301, price: 7283 },
			{ size: "48.0kW", stack: "Double", inverter: "3P-10kW", rebate: 15322, price: 6762 },
			{ size: "51.2kW", stack: "Double", inverter: "3P-10kW", rebate: 16343, price: 6881 },
		]),
	},

	/* ── Alpha ESS Smile M5 ── */
	{
		name: "Alpha ESS Smile M5 Battery System",
		category: "BATTERY",
		brand: "Alpha ESS",
		description: "Supply and install - Alpha ESS Smile M5 Battery System. Smart meter, battery base, inverter, backup included.",
		img: "/products/battery/alphaess/alphaess.webp",
		pdf: "/products/battery/alphaess/alphaess.pdf",
		specifications: [
			{ key: "Warranty", value: "10 year product warranty" },
			{ key: "Workmanship", value: "5 year workmanship warranty" },
		],
		tags: ["battery", "alpha-ess", "smile-m5", "residential"],
		variants: buildVariants("alpha-ess-smile-m5", [
			{ size: "5kW", stack: "Single", inverter: "1P-5kW", rebate: 1596, price: 5348 },
			{ size: "10kW", stack: "Single", inverter: "1P-5kW", rebate: 3192, price: 5732 },
			{ size: "15kW", stack: "Single", inverter: "1P-5kW", rebate: 4788, price: 6116 },
			{ size: "20kW", stack: "Single", inverter: "1P-5kW", rebate: 6384, price: 6500 },
			{ size: "25kW", stack: "Double", inverter: "1P-5kW", rebate: 7980, price: 7862 },
			{ size: "30kW", stack: "Double", inverter: "1P-5kW", rebate: 9576, price: 8246 },
		]),
	},

	/* ── Alpha Smile M5 (Built-in Inverter) ── */
	{
		name: "Alpha Smile M5 Battery (Built-in Inverter)",
		category: "BATTERY",
		brand: "Alpha ESS",
		description: "Supply and install - Alpha Smile M5 Battery with Built-in Inverter. Smart meter, battery base included.",
		img: "/products/battery/alphaess/alphaess.webp",
		pdf: "/products/battery/alphaess/alphaess.pdf",
		specifications: [
			{ key: "Warranty", value: "10 year product warranty" },
			{ key: "Workmanship", value: "5 year workmanship warranty" },
			{ key: "Feature", value: "Built-in Inverter" },
		],
		tags: ["battery", "alpha-ess", "smile-m5", "built-in-inverter", "residential"],
		variants: buildVariants("alpha-ess-builtin", [
			{ size: "13.2kW", stack: "Single", inverter: "1P-5kW", rebate: 4214, price: 4116 },
			{ size: "26.4kW", stack: "Double", inverter: "1P-10kW", rebate: 8429, price: 4971 },
			{ size: "39.6kW", stack: "Triple", inverter: "1P-15kW", rebate: 12643, price: 5827 },
		]),
	},

	/* ── Hyconics ── */
	{
		name: "Hyconics Battery System",
		category: "BATTERY",
		brand: "Hyconics",
		description: "Supply and install - Hyconics Battery System. Smart meter, battery base, inverter, backup included.",
		img: "/products/battery/hiconics/hiconics.png",
		pdf: "/products/battery/hiconics/hiconics.pdf",
		specifications: [
			{ key: "Warranty", value: "10 year product warranty" },
			{ key: "Workmanship", value: "5 year workmanship warranty" },
		],
		tags: ["battery", "hyconics", "residential"],
		variants: buildVariants("hyconics", [
			{ size: "5kW", stack: "Single", inverter: "1P-6kW", rebate: 1596, price: 6140 },
			{ size: "10kW", stack: "Single", inverter: "1P-6kW", rebate: 3192, price: 4544 },
			{ size: "15kW", stack: "Single", inverter: "1P-6kW", rebate: 4788, price: 4309 },
			{ size: "20kW", stack: "Double", inverter: "1P-6kW", rebate: 6384, price: 5119 },
			{ size: "25kW", stack: "Double", inverter: "1P-6kW", rebate: 7980, price: 4818 },
			{ size: "30kW", stack: "Double", inverter: "1P-6kW", rebate: 9576, price: 4988 },
		]),
	},

	/* ── Fox ESS ── */
	{
		name: "Fox ESS Battery System",
		category: "BATTERY",
		brand: "Fox ESS",
		description: "Supply and install - Fox ESS Battery System. Smart meter, battery base, inverter, backup included.",
		img: "/products/battery/foxess/foxess.png",
		pdf: "/products/battery/foxess/foxess.pdf",
		specifications: [
			{ key: "Warranty", value: "10 year product warranty" },
			{ key: "Workmanship", value: "5 year workmanship warranty" },
		],
		tags: ["battery", "foxess", "residential"],
		variants: buildVariants("foxess", [
			{ size: "9.33kW", stack: "Single", inverter: "1P-5kW", rebate: 2978, price: 4648 },
			{ size: "13.98kW", stack: "Single", inverter: "1P-5kW", rebate: 4464, price: 4852 },
			{ size: "18.64kW", stack: "Single", inverter: "1P-5kW", rebate: 5951, price: 5057 },
			{ size: "23.30kW", stack: "Single", inverter: "1P-5kW", rebate: 7438, price: 5261 },
			{ size: "27.96kW", stack: "Single", inverter: "1P-5kW", rebate: 8925, price: 5466 },
			{ size: "32.62kW", stack: "Single", inverter: "1P-5kW", rebate: 10412, price: 6080 },
			{ size: "37.28kW", stack: "Single", inverter: "1P-5kW", rebate: 11899, price: 6285 },
			{ size: "41.94kW", stack: "Single", inverter: "1P-5kW", rebate: 13385, price: 6490 },
			{ size: "9.33kW", stack: "Single", inverter: "1P-8kW", rebate: 2978, price: 5378 },
			{ size: "13.98kW", stack: "Single", inverter: "1P-8kW", rebate: 4464, price: 5583 },
			{ size: "18.64kW", stack: "Single", inverter: "1P-8kW", rebate: 5951, price: 5788 },
			{ size: "23.30kW", stack: "Single", inverter: "1P-8kW", rebate: 7438, price: 5992 },
			{ size: "27.96kW", stack: "Single", inverter: "1P-8kW", rebate: 8925, price: 6197 },
			{ size: "32.62kW", stack: "Single", inverter: "1P-8kW", rebate: 10412, price: 6811 },
			{ size: "37.28kW", stack: "Single", inverter: "1P-8kW", rebate: 11899, price: 7016 },
			{ size: "41.94kW", stack: "Single", inverter: "1P-8kW", rebate: 13385, price: 7221 },
			{ size: "9.33kW", stack: "Single", inverter: "1P-10kW", rebate: 2978, price: 5642 },
			{ size: "13.98kW", stack: "Single", inverter: "1P-10kW", rebate: 4464, price: 5847 },
			{ size: "18.64kW", stack: "Single", inverter: "1P-10kW", rebate: 5951, price: 6052 },
			{ size: "23.30kW", stack: "Single", inverter: "1P-10kW", rebate: 7438, price: 6256 },
			{ size: "27.96kW", stack: "Single", inverter: "1P-10kW", rebate: 8925, price: 6461 },
			{ size: "32.62kW", stack: "Single", inverter: "1P-10kW", rebate: 10412, price: 7075 },
			{ size: "37.28kW", stack: "Single", inverter: "1P-10kW", rebate: 11899, price: 7280 },
			{ size: "41.94kW", stack: "Single", inverter: "1P-10kW", rebate: 13385, price: 7485 },
			{ size: "9.33kW", stack: "Single", inverter: "3P-10kW", rebate: 2978, price: 6040 },
			{ size: "13.98kW", stack: "Single", inverter: "3P-10kW", rebate: 4464, price: 6244 },
			{ size: "18.64kW", stack: "Single", inverter: "3P-10kW", rebate: 5951, price: 6449 },
			{ size: "23.30kW", stack: "Single", inverter: "3P-10kW", rebate: 7438, price: 6653 },
			{ size: "27.96kW", stack: "Single", inverter: "3P-10kW", rebate: 8925, price: 6858 },
			{ size: "32.62kW", stack: "Single", inverter: "3P-10kW", rebate: 10412, price: 7472 },
			{ size: "37.28kW", stack: "Single", inverter: "3P-10kW", rebate: 11899, price: 7677 },
			{ size: "41.94kW", stack: "Single", inverter: "3P-10kW", rebate: 13385, price: 7882 },
		]),
	},

	/* ── Dyness Cygni ── */
	{
		name: "Dyness Cygni Battery System",
		category: "BATTERY",
		brand: "Dyness",
		description: "Supply and install - Dyness Cygni Battery System. Smart meter, battery base, inverter, backup included.",
		img: "",
		pdf: "",
		specifications: [
			{ key: "Warranty", value: "10 year product warranty" },
			{ key: "Workmanship", value: "5 year workmanship warranty" },
		],
		tags: ["battery", "dyness", "cygni", "residential"],
		variants: buildVariants("dyness-cygni", [
			{ size: "15.35kW", stack: "Single", inverter: "1P-10kW", rebate: 4900, price: 4389 },
			{ size: "23.04kW", stack: "Double", inverter: "1P-10kW", rebate: 7354, price: 5817 },
			{ size: "30.72kW", stack: "Double", inverter: "1P-10kW", rebate: 9807, price: 5544 },
			{ size: "15.35kW", stack: "Single", inverter: "3P-10kW", rebate: 4900, price: 4785 },
			{ size: "23.04kW", stack: "Double", inverter: "3P-10kW", rebate: 7354, price: 6213 },
			{ size: "30.72kW", stack: "Double", inverter: "3P-10kW", rebate: 9807, price: 5940 },
		]),
	},

	/* ── SAJ ── */
	{
		name: "SAJ Battery System",
		category: "BATTERY",
		brand: "SAJ",
		description: "Supply and install - SAJ Battery System. Smart meter, battery base, inverter, backup included.",
		img: "",
		pdf: "",
		specifications: [
			{ key: "Warranty", value: "10 year product warranty" },
			{ key: "Workmanship", value: "5 year workmanship warranty" },
		],
		tags: ["battery", "saj", "residential"],
		variants: buildVariants("saj", [
			{ size: "5kW", stack: "Single", inverter: "1P-9.9kW", rebate: 1596, price: 5479 },
			{ size: "10kW", stack: "Single", inverter: "1P-9.9kW", rebate: 3192, price: 5720 },
			{ size: "15kW", stack: "Single", inverter: "1P-9.9kW", rebate: 4788, price: 5795 },
			{ size: "20kW", stack: "Single", inverter: "1P-9.9kW", rebate: 6384, price: 6103 },
			{ size: "25kW", stack: "Single", inverter: "1P-9.9kW", rebate: 7980, price: 6411 },
			{ size: "30kW", stack: "Double", inverter: "1P-9.9kW", rebate: 9576, price: 7980 },
			{ size: "35kW", stack: "Double", inverter: "1P-9.9kW", rebate: 11172, price: 7995 },
			{ size: "40kW", stack: "Double", inverter: "1P-9.9kW", rebate: 12768, price: 8203 },
			{ size: "45kW", stack: "Double", inverter: "1P-9.9kW", rebate: 14364, price: 8471 },
			{ size: "50kW", stack: "Double", inverter: "1P-9.9kW", rebate: 15960, price: 9079 },
			{ size: "5kW", stack: "Single", inverter: "3P-10kW", rebate: 1596, price: 6865 },
			{ size: "10kW", stack: "Single", inverter: "3P-10kW", rebate: 3192, price: 7173 },
			{ size: "15kW", stack: "Single", inverter: "3P-10kW", rebate: 4788, price: 7281 },
			{ size: "20kW", stack: "Single", inverter: "3P-10kW", rebate: 6384, price: 7489 },
			{ size: "25kW", stack: "Single", inverter: "3P-10kW", rebate: 7980, price: 7697 },
			{ size: "30kW", stack: "Double", inverter: "3P-10kW", rebate: 9576, price: 9273 },
			{ size: "35kW", stack: "Double", inverter: "3P-10kW", rebate: 11172, price: 9481 },
			{ size: "40kW", stack: "Double", inverter: "3P-10kW", rebate: 12768, price: 9589 },
			{ size: "45kW", stack: "Double", inverter: "3P-10kW", rebate: 14364, price: 9757 },
			{ size: "50kW", stack: "Double", inverter: "3P-10kW", rebate: 15960, price: 10465 },
		]),
	},
];

/* ================================================================
   AIRCON PRODUCTS
   ================================================================ */
const airconProducts: SeedProduct[] = [
	{
		name: "RINNAI 18kw MULTI SPLIT SYSTEM",
		category: "AIRCON",
		brand: "Rinnai",
		description: "Supply & Install Brand-Rinnai, Modal-MON6H18B cooling-17.5kw heating-20kw.",
		img: "/products/aircon/Rinnai/rinnai multi split.png",
		pdf: "/products/aircon/Rinnai/Rinnai multi split.pdf",
		specifications: [
			{ key: "Cooling", value: "17.5kW" },
			{ key: "Heating", value: "20kW" },
			{ key: "Model", value: "MON6H18B" },
		],
		tags: ["aircon", "rinnai", "multi-split", "18kw"],
		variants: [{ id: "rinnai-multi-1", capacity: "18kW", phase: "", rebate: 7000, price: 9200, additional: { stack: "", inverter: "" } }],
	},
	{
		name: "Rinnai 18KW Ducted System",
		category: "AIRCON",
		brand: "Rinnai",
		description: "Supply & Install RINNAI Ducted system brand-RINNAI, modal-DONSR18B1/ DONLR18B1 upto 8 vents.",
		img: "/products/aircon/Rinnai/rinnai ducted.jpeg",
		pdf: "/products/aircon/Rinnai/rinnai ducted.pdf",
		specifications: [
			{ key: "Model", value: "DONSR18B1 / DONLR18B1" },
			{ key: "Vents", value: "Up to 8" },
		],
		tags: ["aircon", "rinnai", "ducted", "18kw"],
		variants: [{ id: "rinnai-ducted-1", capacity: "18kW", phase: "", rebate: 7000, price: 9200, additional: { stack: "", inverter: "" } }],
	},
	{
		name: "Midea 23kw mini VRF SYSTEM",
		category: "AIRCON",
		brand: "Midea",
		description: "Supply & Install Brand-Midea, Modal-MDV-v235wn1(au)-R cooling-20kw heating-23.5kw.",
		img: "/products/aircon/midea/midea 23kw VRF.pdf.png",
		pdf: "/products/aircon/midea/midea 23kw VRF.pdf",
		specifications: [
			{ key: "Cooling", value: "20kW" },
			{ key: "Heating", value: "23.5kW" },
			{ key: "Model", value: "MDV-v235wn1(au)-R" },
		],
		tags: ["aircon", "midea", "vrf", "23kw"],
		variants: [{ id: "midea-vrf-1", capacity: "23kW", phase: "", rebate: 7000, price: 9200, additional: { stack: "", inverter: "" } }],
	},
	{
		name: "Midea 18kw multi split SYSTEM",
		category: "AIRCON",
		brand: "Midea",
		description: "Supply & Install Brand-Midea, Modal-MULMI0618B cooling-18kw heating-20.5kw.",
		img: "/products/aircon/midea/midea multi split SYSTEM.png",
		pdf: "/products/aircon/midea/midea multi split SYSTEM.pdf",
		specifications: [
			{ key: "Cooling", value: "18kW" },
			{ key: "Heating", value: "20.5kW" },
			{ key: "Model", value: "MULMI0618B" },
		],
		tags: ["aircon", "midea", "multi-split", "18kw"],
		variants: [{ id: "midea-multi-1", capacity: "18kW", phase: "", rebate: 7000, price: 9200, additional: { stack: "", inverter: "" } }],
	},
];

/* ================================================================
   SOLAR PRODUCTS (ONLY with battery combo)
   ================================================================ */
const solarProducts: SeedProduct[] = [
	{
		name: "Small Residential Solar Systems (Battery Combo)",
		category: "SOLAR",
		brand: "Various",
		description: "Supply & Install - Small Residential Solar Systems. ONLY available with battery combo.",
		img: "",
		pdf: "",
		specifications: [
			{ key: "Note", value: "ONLY with battery combo" },
			{ key: "Rebate", value: "Solar VIC Rebate $2,800 GST-free" },
		],
		tags: ["solar", "residential", "battery-combo"],
		variants: buildVariants("solar-combo", [
			{ size: "3.3kW", stack: "", inverter: "", rebate: 3540, price: 500 },
			{ size: "5kW", stack: "", inverter: "", rebate: 3921, price: 700 },
			{ size: "6.6kW", stack: "", inverter: "", rebate: 4280, price: 1100 },
			{ size: "8kW", stack: "", inverter: "", rebate: 4594, price: 1742 },
			{ size: "10kW", stack: "", inverter: "", rebate: 5042, price: 2878 },
			{ size: "13.2kW", stack: "", inverter: "", rebate: 5759, price: 4695 },
			{ size: "15kW", stack: "", inverter: "", rebate: 6163, price: 5717 },
		]),
	},
];

/* ================================================================
   HEAT PUMP PRODUCTS
   ================================================================ */
const heatPumpProducts: SeedProduct[] = [
	{
		name: "SPT Heat Pump 315L",
		category: "HEAT_PUMP",
		brand: "SPT",
		description: "Supply & Install SPT Heat Pump Hot Water System.",
		img: "/products/heat-pump/spt/spt.png",
		pdf: "/products/heat-pump/spt/spt.pdf",
		specifications: [{ key: "Capacity", value: "315L" }],
		tags: ["heat-pump", "spt", "hot-water"],
		variants: [{ id: "spt-315l-1", capacity: "315L", phase: "", rebate: 2680, price: 3880, additional: { stack: "", inverter: "" } }],
	},
	{
		name: "Midea Heat Pump",
		category: "HEAT_PUMP",
		brand: "Midea",
		description: "Supply & Install Midea Heat Pump Hot Water System.",
		img: "/products/heat-pump/midea/midea.png",
		pdf: "/products/heat-pump/midea/midea.pdf",
		specifications: [],
		tags: ["heat-pump", "midea", "hot-water"],
		variants: [{ id: "midea-hp-1", capacity: "", phase: "", rebate: 2680, price: 3680, additional: { stack: "", inverter: "" } }],
	},
	{
		name: "Emerald Heat Pump",
		category: "HEAT_PUMP",
		brand: "Emerald",
		description: "Supply & Install Emerald Heat Pump Hot Water System.",
		img: "/products/heat-pump/emerald/emerald.png",
		pdf: "/products/heat-pump/emerald/emerald.pdf",
		specifications: [],
		tags: ["heat-pump", "emerald", "hot-water"],
		variants: [{ id: "emerald-hp-1", capacity: "", phase: "", rebate: 2680, price: 4280, additional: { stack: "", inverter: "" } }],
	},
	{
		name: "Neopower Heat Pump",
		category: "HEAT_PUMP",
		brand: "Neopower",
		description: "Supply & Install Neopower Heat Pump Hot Water System.",
		img: "/products/heat-pump/neopower/neopower.png",
		pdf: "/products/heat-pump/neopower/neopower.pdf",
		specifications: [],
		tags: ["heat-pump", "neopower", "hot-water"],
		variants: [{ id: "neopower-hp-1", capacity: "", phase: "", rebate: 2680, price: 3680, additional: { stack: "", inverter: "" } }],
	},
	{
		name: "iStore Heat Pump",
		category: "HEAT_PUMP",
		brand: "iStore",
		description: "Supply & Install iStore Heat Pump Hot Water System.",
		img: "/products/heat-pump/istore/istore.png",
		pdf: "/products/heat-pump/istore/istore.pdf",
		specifications: [],
		tags: ["heat-pump", "istore", "hot-water"],
		variants: [{ id: "istore-hp-1", capacity: "", phase: "", rebate: 2680, price: 4880, additional: { stack: "", inverter: "" } }],
	},
];

/* ================================================================
   EXTRA / ADD-ON PRODUCTS
   ================================================================ */
function makeExtra(name: string, desc: string, price: number, tags: string[] = []): SeedProduct {
	return {
		name,
		category: "EXTRAS",
		brand: "",
		description: desc,
		img: "",
		pdf: "",
		specifications: [],
		tags: ["extra", "add-on", ...tags],
		variants: [{ id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), capacity: "", phase: "", rebate: 0, price, additional: { stack: "", inverter: "" } }],
	};
}

const extraProducts: SeedProduct[] = [
	/* Roof Works & Complications */
	makeExtra("Terracotta Roof", "One-off charge for terracotta roof installation", 200, ["roof"]),
	makeExtra("Multiple Story - Double story", "Double story installation surcharge", 250, ["roof", "story"]),
	makeExtra("Multiple Story - Triple story", "Triple story installation surcharge", 365, ["roof", "story"]),
	makeExtra("Landscape Panels (per panel)", "Per panel installation for landscape orientation", 18, ["roof", "panels"]),
	makeExtra("Tilt Kit (per panel)", "Tilt kit per panel", 18, ["roof", "tilt"]),
	makeExtra("Split Array (per split, >2 arrays)", "Per split for more than 2 arrays", 77, ["roof", "array"]),
	makeExtra("Obstructions Split (per split, >1 array)", "Per split for more than 1 array", 35, ["roof", "obstruction"]),
	makeExtra("Steep/Slippery Roof 30-40° (per panel)", "Steep/Slippery/Cathedral roof 30-40 degrees per panel", 25, ["roof", "steep"]),
	makeExtra("Steep/Slippery Roof 40-45° (per panel)", "Steep/Slippery/Cathedral roof 40-45 degrees per panel", 35, ["roof", "steep"]),
	makeExtra("Kliplock Roof (per panel)", "Per panel surcharge for Kliplock roof", 2.50, ["roof", "kliplock"]),

	/* System Components & Accessories */
	makeExtra("Micro Inverter Accessories (per panel)", "Micro inverter accessories per panel", 35, ["accessories", "inverter"]),
	makeExtra("Optimiser - Tigo (per panel)", "Tigo optimiser per panel", 13, ["accessories", "optimiser"]),
	makeExtra("Export Limiter / Monitoring System", "Complete export limiter / monitoring system", 130, ["accessories", "monitoring"]),
	makeExtra("Extra Inverter Installation", "Additional inverter setup", 275, ["accessories", "inverter"]),
	makeExtra("Installation of EV Charger (labor only)", "EV charger installation - labor only", 750, ["accessories", "ev-charger"]),

	/* Switchboard - Enclosures */
	makeExtra("Single Pole Enclosure", "Supply and install single pole enclosure", 90, ["switchboard", "enclosure"]),
	makeExtra("Two Pole Enclosure", "Supply and install two pole enclosure", 100, ["switchboard", "enclosure"]),
	makeExtra("Four Pole Enclosure", "Supply and install four pole enclosure", 120, ["switchboard", "enclosure"]),

	/* Switchboard - Complete Upgrades */
	makeExtra("Switchboard Partial Upgrade", "Switchboard modification / partial upgrade", 300, ["switchboard", "upgrade"]),
	makeExtra("Switchboard 1 Phase 6 Pole", "Supply and install 1 Phase 6 Pole switchboard", 550, ["switchboard", "upgrade"]),
	makeExtra("Switchboard 1 Phase 12 Pole", "Supply and install 1 Phase 12 Pole switchboard", 1200, ["switchboard", "upgrade"]),
	makeExtra("Switchboard 3 Phase 6 Poles", "Supply and install 3 Phase 6 Poles switchboard", 650, ["switchboard", "upgrade"]),
	makeExtra("Switchboard 3 Phase 12 Poles", "Supply and install 3 Phase 12 Poles switchboard", 1350, ["switchboard", "upgrade"]),

	/* Switchboard - Individual Components */
	makeExtra("Main Switch", "Supply and install main switch", 63, ["switchboard", "component"]),
	makeExtra("RCD/MCB", "Supply and install RCD/MCB", 83, ["switchboard", "component"]),
	makeExtra("Internal Switchboard Work", "Internal switchboard labor charge", 200, ["switchboard", "labor"]),

	/* Electrical Works */
	makeExtra("Additional Cable Run (per meter, >15m)", "Additional cable run per meter over 15m run", 3.50, ["electrical", "cable"]),

	/* Equipment Hire */
	makeExtra("Scissor Lift Hire (daily)", "Scissor lift daily hire rate", 650, ["equipment", "hire"]),
	makeExtra("Boom Lift Hire (daily)", "Boom lift daily hire rate", 750, ["equipment", "hire"]),

	/* Site Modifications */
	makeExtra("Antenna Relocation", "Moving existing antenna", 85, ["site", "antenna"]),
	makeExtra("Remove Antenna", "Complete antenna removal", 70, ["site", "antenna"]),
	makeExtra("Edge Protection Single", "Edge protection single - if over 10m required", 175, ["site", "safety"]),
	makeExtra("Edge Protection Double", "Edge protection double - if over 10m required", 350, ["site", "safety"]),
	makeExtra("Inverter Shade Awning", "Supply and install inverter shade awning", 155, ["site", "awning"]),
	makeExtra("Bollard", "Supply and install bollard", 120, ["site", "bollard"]),

	/* System Removal */
	makeExtra("Removal & Disposal Old System (per panel)", "Removal and disposal of old system per panel", 30, ["removal"]),

	/* Travel */
	makeExtra("Travel (per km after 100km roundtrip)", "Travel charge after 100kms roundtrip from CBD, per km", 1.15, ["travel"]),

	/* Battery extras */
	makeExtra("Battery Backup Add-on", "Backup add-on for battery system", 300, ["battery", "backup"]),
	makeExtra("Battery Garage Installation", "Garage installation for battery system", 400, ["battery", "garage"]),
];

/* ================================================================
   INVERTER PRODUCTS
   ================================================================ */
const inverterProducts: SeedProduct[] = [
	// Add inverter products here
];

/* ================================================================
   COMBINE ALL PRODUCTS
   ================================================================ */
const allProducts: SeedProduct[] = [
	...airconProducts,
	...batteryProducts,
	...solarProducts,
	...heatPumpProducts,
	...inverterProducts,
	...extraProducts,
];

/* ================================================================
   SEED FUNCTION
   ================================================================ */
export const seedProducts = async () => {
	try {
		const productNames = allProducts.map((p) => p.name);

		const existingProducts = await productRepository.find(
			{ name: { $in: productNames } },
			{ select: "name", lean: true },
		);

		const existingNames = new Set(existingProducts.map((p: any) => p.name));

		const newProducts = allProducts
			.filter((p) => !existingNames.has(p.name))
			.map((p) => ({
				name: p.name,
				slug: p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
				category: p.category,
				brand: p.brand || null,
				description: p.description || null,
				img: p.img || null,
				pdf: p.pdf || null,
				specifications: p.specifications,
				tags: p.tags,
				variants: p.variants,
				status: "ACTIVE",
				created_by: 1, // system / admin user
			}));

		if (newProducts.length) {
			await productRepository.createMany(newProducts);
		}

		console.log(`[seedProducts] Inserted: ${newProducts.length} new products`);
		console.log(`[seedProducts] Already exists: ${existingNames.size} products`);
		console.log(
			`[seedProducts] New product names:`,
			newProducts.map((p) => p.name),
		);
	} catch (error) {
		console.error("[seedProducts] Error:", error);
		throw error;
	}
};
