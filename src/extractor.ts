/**
 * Instagram Video Extractor
 *
 * Core extraction logic using Playwright network interception.
 * Adapted from instagram-video-mcp for standalone CLI usage.
 */

import { chromium, Browser, BrowserContext, Page, Response } from "playwright";

// ============================================================================
// Types
// ============================================================================

export interface VideoInfo {
  url: string;
  quality: string;
  bitrate: number;
  shortCode: string;
  caption?: string;
  username?: string;
  timestamp?: string;
  views?: string;
}

export interface ExtractResult {
  success: boolean;
  videos: VideoInfo[];
  error?: string;
}

interface CapturedVideo {
  url: string;
  bitrate: number;
  quality: string;
}

// ============================================================================
// Constants
// ============================================================================

const CDN_PATTERN = "cdninstagram.com";
const MP4_PATTERN = ".mp4";
const AUDIO_INDICATORS = ["audio", "dash_ln_heaac"];
const DEFAULT_WAIT_MS = 5000;
const NAV_TIMEOUT_MS = 60000;

// ============================================================================
// Utility Functions
// ============================================================================

function parseEfgParam(url: string): { bitrate: number; quality: string; isAudio: boolean } {
  const defaults = { bitrate: 0, quality: "unknown", isAudio: false };
  try {
    const urlObj = new URL(url);
    const efg = urlObj.searchParams.get("efg");
    if (!efg) return defaults;

    const decoded = Buffer.from(efg, "base64").toString("utf-8");
    const data = JSON.parse(decoded);
    const bitrate = typeof data.bitrate === "number" ? data.bitrate : 0;

    let quality = "unknown";
    const jsonStr = JSON.stringify(data);
    const qualityMatch = jsonStr.match(/q(\d{2})/);
    if (qualityMatch) {
      quality = `q${qualityMatch[1]}`;
    }

    const isAudio = AUDIO_INDICATORS.some((ind) => jsonStr.toLowerCase().includes(ind));
    return { bitrate, quality, isAudio };
  } catch {
    return defaults;
  }
}

function stripByteRangeParams(url: string): string {
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.delete("bytestart");
    urlObj.searchParams.delete("byteend");
    return urlObj.toString();
  } catch {
    return url;
  }
}

export function extractShortCode(url: string): string | undefined {
  const match = url.match(/\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return match?.[2];
}

// ============================================================================
// Extractor Class
// ============================================================================

export class InstagramExtractor {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--window-size=1920,1080",
      ],
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      locale: "en-US",
      timezoneId: "America/New_York",
    });

    // Block unnecessary resources for performance
    await this.context.route("**/*", (route) => {
      const url = route.request().url();
      const resourceType = route.request().resourceType();

      if (["media", "document", "xhr", "fetch", "script"].includes(resourceType)) {
        route.continue();
        return;
      }

      if (
        resourceType === "font" ||
        resourceType === "stylesheet" ||
        url.includes("google-analytics") ||
        url.includes("googletagmanager") ||
        url.includes("facebook.com/tr") ||
        url.includes("connect.facebook.net") ||
        (resourceType === "image" && !url.includes(CDN_PATTERN))
      ) {
        route.abort();
        return;
      }

      route.continue();
    });
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private async createPage(): Promise<Page> {
    if (!this.context) {
      throw new Error("Extractor not initialized. Call initialize() first.");
    }
    return await this.context.newPage();
  }

  // ==========================================================================
  // Extract video from a single post/reel
  // ==========================================================================

  async extractFromPost(url: string): Promise<ExtractResult> {
    const page = await this.createPage();
    const captured = new Map<string, CapturedVideo>();

    try {
      const onResponse = (response: Response) => {
        const resUrl = response.url();
        if (!resUrl.includes(MP4_PATTERN) || !resUrl.includes(CDN_PATTERN)) return;

        const { bitrate, quality, isAudio } = parseEfgParam(resUrl);
        if (isAudio) return;

        const cleanUrl = stripByteRangeParams(resUrl);
        const existing = captured.get(cleanUrl);
        if (!existing || bitrate > existing.bitrate) {
          captured.set(cleanUrl, { url: cleanUrl, bitrate, quality });
        }
      };

      page.on("response", onResponse);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
      await this.handleLoginPopup(page);
      await page.waitForTimeout(DEFAULT_WAIT_MS);

      // If no video captured, try clicking play
      if (captured.size === 0) {
        await this.tryPlayVideo(page);
        await page.waitForTimeout(3000);
      }

      page.off("response", onResponse);

      if (captured.size === 0) {
        return {
          success: false,
          videos: [],
          error: "No video URLs captured. The post may not contain a video, or it may require login.",
        };
      }

      const sorted = Array.from(captured.values()).sort((a, b) => b.bitrate - a.bitrate);
      const metadata = await this.extractMetadata(page, url);
      const shortCode = extractShortCode(url) || "unknown";

      const videos: VideoInfo[] = sorted.map((v) => ({
        url: v.url,
        quality: v.quality,
        bitrate: v.bitrate,
        shortCode,
        ...metadata,
      }));

      return { success: true, videos };
    } catch (error) {
      return {
        success: false,
        videos: [],
        error: `Extract error: ${error instanceof Error ? error.message : String(error)}`,
      };
    } finally {
      await page.close();
    }
  }

  // ==========================================================================
  // Collect reel links from a user's profile
  // ==========================================================================

  async collectReelLinks(
    username: string,
    maxVideos: number = 30,
    scrollTimeout: number = 30000
  ): Promise<string[]> {
    const page = await this.createPage();

    try {
      const profileUrl = `https://www.instagram.com/${username}/reels/`;
      await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
      await page.waitForTimeout(2000);
      await this.handleLoginPopup(page);

      // Wait for SPA content to render after popup dismissal
      const reelSelector = "a[href*=\"/reel/\"], a[href*=\"/p/\"]";
      try {
        await page.waitForSelector(reelSelector, { timeout: 15000 });
      } catch {
        // Content may load lazily — continue to scroll-based collection
        await page.waitForTimeout(3000);
      }

      const startTime = Date.now();
      let reelLinks: string[] = [];
      let stableRounds = 0;

      while (reelLinks.length < maxVideos && Date.now() - startTime < scrollTimeout) {
        const links = await page.evaluate((sel: string) => {
          const anchors = document.querySelectorAll(sel);
          const hrefs: string[] = [];
          anchors.forEach((a) => {
            const href = a.getAttribute("href");
            if (href) {
              hrefs.push(href.startsWith("http") ? href : `https://www.instagram.com${href}`);
            }
          });
          return [...new Set(hrefs)];
        }, reelSelector);

        const prevCount = reelLinks.length;
        reelLinks = [...new Set(links)];
        if (reelLinks.length >= maxVideos) break;

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(2000);

        if (reelLinks.length === prevCount) {
          stableRounds++;
          if (stableRounds >= 3) break;
        } else {
          stableRounds = 0;
        }
      }

      return reelLinks.slice(0, maxVideos);
    } catch (error) {
      console.error(`Failed to collect reel links for @${username}:`, error instanceof Error ? error.message : String(error));
      return [];
    } finally {
      await page.close();
    }
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private async extractMetadata(page: Page, url: string): Promise<Partial<VideoInfo>> {
    const shortCode = extractShortCode(url);
    const metadata: Partial<VideoInfo> = { shortCode: shortCode || undefined };

    try {
      const pageData = await page.evaluate(() => {
        const result: { caption?: string; username?: string; views?: string } = {};

        const metaTitle = document.querySelector("meta[property=\"og:title\"]");
        if (metaTitle) {
          const content = metaTitle.getAttribute("content") || "";
          const match = content.match(/^(.+?)\s+on\s+Instagram/);
          if (match) result.username = match[1].trim();
        }

        if (!result.username) {
          const headerLink = document.querySelector("header a[href^=\"/\"]");
          if (headerLink) result.username = headerLink.textContent?.trim();
        }

        const metaDesc = document.querySelector("meta[property=\"og:description\"]");
        if (metaDesc) {
          const desc = metaDesc.getAttribute("content") || "";
          const captionMatch = desc.match(/- "(.+)"/) || desc.match(/[–—]\s*(.+)/);
          if (captionMatch) {
            result.caption = captionMatch[1].trim();
          } else {
            result.caption = desc.trim();
          }
        }

        const viewsRegex = /(\d[\d,.]*[KMB]?)\s*(views|plays|播放)/i;
        const bodyText = document.body.innerText;
        const viewsMatch = bodyText.match(viewsRegex);
        if (viewsMatch) result.views = viewsMatch[1];

        return result;
      });

      return { ...metadata, ...pageData };
    } catch {
      return metadata;
    }
  }

  private async tryPlayVideo(page: Page): Promise<void> {
    try {
      const videoEl = page.locator("video").first();
      if (await videoEl.isVisible({ timeout: 2000 }).catch(() => false)) {
        await videoEl.click();
        return;
      }
      const playButton = page.locator("[aria-label=\"Play\"], [aria-label=\"播放\"]").first();
      if (await playButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await playButton.click();
      }
    } catch {
      // Silently ignore play attempts
    }
  }

  private async handleLoginPopup(page: Page): Promise<void> {
    try {
      const dismissSelectors = [
        "button:has-text(\"关闭\")",
        "button:has-text(\"Not Now\")",
        "button:has-text(\"Not now\")",
        "button:has-text(\"以后再说\")",
        "button:has-text(\"稍后再说\")",
        "button:has-text(\"Ahora no\")",
        "button:has-text(\"Agora não\")",
        "[role=\"button\"]:has-text(\"Not Now\")",
        "[role=\"button\"]:has-text(\"关闭\")",
        "[aria-label=\"Close\"]",
        "[aria-label=\"关闭\"]",
      ];

      for (const selector of dismissSelectors) {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 1500 }).catch(() => false)) {
          await button.click();
          await page.waitForTimeout(1000);
          return;
        }
      }

      // Fallback: find any visible dialog/overlay and press Escape
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    } catch {
      // popup may not appear on all pages
    }
  }
}
