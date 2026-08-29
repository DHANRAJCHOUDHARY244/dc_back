import http from "http";
import https from "https";
import { lookup } from "dns/promises";
import { isIP } from "net";

export type LinkPreview = {
  url: string;
  title: string;
  description: string;
  image: string;
};

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal"]);

function isPrivateIp(ip: string) {
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return true;
  if (isIP(ip) === 4) {
    const parts = ip.split(".").map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 0) return true;
  }
  if (isIP(ip) === 6) {
    const lower = ip.toLowerCase();
    if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80")) return true;
  }
  return false;
}

export async function assertSafeFetchUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Unsupported protocol");
  }
  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) throw new Error("Blocked host");
  if (isPrivateIp(hostname)) throw new Error("Blocked host");

  const resolved = await lookup(hostname, { verbatim: true });
  if (isPrivateIp(resolved.address)) throw new Error("Blocked host");
  return parsed;
}

export function extractUrls(text: string): string[] {
  const matches = String(text || "").match(URL_REGEX) || [];
  const cleaned = matches.map((u) => u.replace(/[.,;:!?)]+$/, ""));
  return [...new Set(cleaned)].slice(0, 2);
}

function fetchHtml(url: string, timeoutMs = 4000): Promise<string> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { timeout: timeoutMs, headers: { "User-Agent": "SOMS-ChatBot/1.0" } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        assertSafeFetchUrl(res.headers.location)
          .then((safe) => fetchHtml(safe.toString(), timeoutMs))
          .then(resolve)
          .catch(reject);
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (c) => {
        chunks.push(c);
        if (chunks.reduce((n, b) => n + b.length, 0) > 120_000) res.destroy();
      });
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8").slice(0, 120_000)));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

function metaContent(html: string, property: string) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return "";
}

function sanitizePreviewUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

export async function buildLinkPreviews(text: string): Promise<LinkPreview[]> {
  const urls = extractUrls(text);
  const previews: LinkPreview[] = [];

  await Promise.all(
    urls.map(async (url) => {
      try {
        const safe = await assertSafeFetchUrl(url);
        const html = await fetchHtml(safe.toString());
        const title =
          metaContent(html, "og:title") ||
          metaContent(html, "twitter:title") ||
          html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ||
          "";
        const description = metaContent(html, "og:description") || metaContent(html, "description") || "";
        const image = sanitizePreviewUrl(metaContent(html, "og:image") || metaContent(html, "twitter:image") || "");
        previews.push({
          url: safe.toString(),
          title: title.slice(0, 200),
          description: description.slice(0, 300),
          image,
        });
      } catch {
        // skip unsafe or failed previews
      }
    }),
  );

  return previews;
}
