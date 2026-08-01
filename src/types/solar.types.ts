export type LatLng = {
  latitude: number;
  longitude: number;
};

export type LatLngBox = {
  sw: LatLng;
  ne: LatLng;
};

export type GeocodeResult = {
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId?: string;
};

export type SolarPanel = {
  center: LatLng;
  orientation: number;
  yearlyEnergyDcKwh: number;
  segmentIndex: number;
};

export type RoofSegmentStats = {
  pitchDegrees: number;
  azimuthDegrees: number;
  stats: {
    areaMeters2: number;
    sunshineQuantiles: number[];
    groundAreaMeters2: number;
  };
  center: LatLng;
  boundingBox: LatLngBox;
  planeHeightAtCenterMeters: number;
};

export type SolarPanelConfig = {
  panelsCount: number;
  yearlyEnergyDcKwh: number;
  roofSegmentSummaries: Array<{
    pitchDegrees: number;
    azimuthDegrees: number;
    panelsCount: number;
    yearlyEnergyDcKwh: number;
    segmentIndex: number;
  }>;
};

export type SizeAndSunshineStats = {
  areaMeters2: number;
  sunshineQuantiles: number[];
  groundAreaMeters2: number;
};

export type SolarPotential = {
  maxArrayPanelsCount: number;
  panelCapacityWatts: number;
  panelHeightMeters: number;
  panelWidthMeters: number;
  panelLifetimeYears: number;
  maxArrayAreaMeters2: number;
  maxSunshineHoursPerYear: number;
  carbonOffsetFactorKgPerMwh: number;
  wholeRoofStats: SizeAndSunshineStats;
  buildingStats: SizeAndSunshineStats;
  roofSegmentStats: RoofSegmentStats[];
  solarPanels: SolarPanel[];
  solarPanelConfigs: SolarPanelConfig[];
};

export type BuildingInsights = {
  name: string;
  center: LatLng;
  boundingBox: LatLngBox;
  imageryDate: { year: number; month: number; day: number };
  imageryProcessedDate: { year: number; month: number; day: number };
  postalCode: string;
  administrativeArea: string;
  statisticalArea: string;
  regionCode: string;
  solarPotential: SolarPotential;
  imageryQuality: "HIGH" | "MEDIUM" | "BASE";
};
