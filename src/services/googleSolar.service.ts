import type { BuildingInsights, GeocodeResult } from "../types/solar.types";
import { getGoogleMapsApiKeyFromSettings } from "@services/crmSettings.service";

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const BUILDING_INSIGHTS_URL =
  "https://solar.googleapis.com/v1/buildingInsights:findClosest";
const STATIC_MAP_URL = "https://maps.googleapis.com/maps/api/staticmap";

async function getApiKey(): Promise<string> {
  const key = await getGoogleMapsApiKeyFromSettings();
  if (!key) {
    throw new Error("Google Maps API key is not configured in CRM settings");
  }
  return key;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) {
    const message =
      body?.error?.message || body?.error_message || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}

class GoogleSolarService {
  async geocodeAddress(address: string): Promise<GeocodeResult> {
    const key = await getApiKey();
    const url = new URL(GEOCODE_URL);
    url.searchParams.set("address", address.trim());
    url.searchParams.set("key", key);
    url.searchParams.set("region", "au");

    const data = await parseJsonResponse<{
      status: string;
      results?: Array<{
        formatted_address: string;
        place_id: string;
        geometry: { location: { lat: number; lng: number } };
      }>;
      error_message?: string;
    }>(await fetch(url.toString()));

    if (data.status !== "OK" || !data.results?.length) {
      throw new Error(
        data.error_message || "Address not found. Try a full street address.",
      );
    }

    const result = data.results[0];
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
    };
  }

  async getBuildingInsights(
    lat: number,
    lng: number,
  ): Promise<BuildingInsights> {
    const key = await getApiKey();
    const url = new URL(BUILDING_INSIGHTS_URL);
    url.searchParams.set("location.latitude", String(lat));
    url.searchParams.set("location.longitude", String(lng));
    url.searchParams.set("requiredQuality", "MEDIUM");
    url.searchParams.set("key", key);

    try {
      const data = await parseJsonResponse<BuildingInsights>(
        await fetch(url.toString()),
      );
      if (!data?.solarPotential?.solarPanels?.length) {
        throw new Error("No solar panel data returned for this location.");
      }
      return data;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Solar API request failed";
      if (
        message.includes("404") ||
        message.toLowerCase().includes("not found")
      ) {
        throw new Error(
          "No solar data for this address. Try a residential property in a covered area.",
        );
      }
      throw error;
    }
  }

  async getSatelliteImage(
    lat: number,
    lng: number,
    zoom = 20,
    size = 1280,
  ): Promise<Buffer> {
    const key = await getApiKey();
    const url = new URL(STATIC_MAP_URL);
    url.searchParams.set("center", `${lat},${lng}`);
    url.searchParams.set("zoom", String(zoom));
    url.searchParams.set("size", `${size}x${size}`);
    url.searchParams.set("maptype", "satellite");
    url.searchParams.set("scale", "2");
    url.searchParams.set("key", key);

    const response = await fetch(url.toString());
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Failed to fetch satellite imagery");
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

export default new GoogleSolarService();
