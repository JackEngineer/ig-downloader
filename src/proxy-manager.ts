/**
 * 免费代理管理器
 *
 * 自动获取、验证和管理免费代理服务器
 * 支持从多个免费代理源获取代理并自动验证可用性
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname, resolve } from "path";
import { homedir } from "os";
import { createConnection } from "net";
import http from "http";

// ============================================================================
// Types
// ============================================================================

export interface Proxy {
  host: string;
  port: number;
  protocol: "http" | "https" | "socks4" | "socks5";
  country?: string;
  anonymity?: string;
  lastChecked?: Date;
  successCount: number;
  failCount: number;
}

export interface ProxyPool {
  proxies: Proxy[];
  lastUpdated: string;
  currentIndex: number;
}

// ============================================================================
// Constants
// ============================================================================

const PROXY_CACHE_PATH = resolve(homedir(), ".ig-downloader", "proxy-pool.json");
const PROXY_CACHE_TTL_MS = 30 * 60 * 1000;
const PROXY_TEST_TIMEOUT_MS = 10000;
const MAX_PROXIES_TO_TEST = 10;
const MAX_PROXIES_PER_SOURCE = 100;
const MAX_TOTAL_PROXIES = 500;

const PROXY_SOURCES = [
  {
    name: "hw630590-http",
    url: "https://raw.githubusercontent.com/hw630590/free-proxies/refs/heads/main/proxies/http/http.txt",
    parser: parsePlainTextProxies("http"),
  },
  {
    name: "hw630590-https",
    url: "https://raw.githubusercontent.com/hw630590/free-proxies/refs/heads/main/proxies/https/https.txt",
    parser: parsePlainTextProxies("https"),
  },
  {
    name: "hw630590-socks5",
    url: "https://raw.githubusercontent.com/hw630590/free-proxies/refs/heads/main/proxies/socks5/socks5.txt",
    parser: parsePlainTextProxies("socks5"),
  },
  {
    name: "hw630590-socks4",
    url: "https://raw.githubusercontent.com/hw630590/free-proxies/refs/heads/main/proxies/socks4/socks4.txt",
    parser: parsePlainTextProxies("socks4"),
  },
  {
    name: "proxifly-all",
    url: "https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/all/data.txt",
    parser: parsePlainTextProxies("http"),
  },
  {
    name: "proxifly-http",
    url: "https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/protocols/http/data.txt",
    parser: parsePlainTextProxies("http"),
  },
  {
    name: "proxifly-socks5",
    url: "https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/protocols/socks5/data.txt",
    parser: parsePlainTextProxies("socks5"),
  },
];

// ============================================================================
// Proxy Parser Functions
// ============================================================================

function parsePlainTextProxies(protocol: Proxy["protocol"]) {
  return (text: string): Proxy[] => {
    const proxies: Proxy[] = [];
    const lines = text.trim().split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const parts = trimmed.split(":");
      if (parts.length >= 2) {
        const host = parts[0];
        const port = parseInt(parts[1], 10);

        if (host && !Number.isNaN(port) && port > 0 && port <= 65535) {
          proxies.push({
            host,
            port,
            protocol,
            successCount: 0,
            failCount: 0,
          });
        }
      }
    }

    return proxies;
  };
}

function parseProxy5Json(protocol: Proxy["protocol"]) {
  return (text: string): Proxy[] => {
    try {
      const data = JSON.parse(text);
      if (!Array.isArray(data)) return [];

      return data
        .filter((item: unknown) => {
          if (typeof item !== "object" || item === null) return false;
          const obj = item as Record<string, unknown>;
          return typeof obj.ip === "string" && typeof obj.port === "number";
        })
        .map((item: unknown) => {
          const obj = item as Record<string, unknown>;
          return {
            host: obj.ip as string,
            port: obj.port as number,
            protocol: (obj.protocol as Proxy["protocol"]) || protocol,
            country: obj.country as string | undefined,
            anonymity: obj.anonymity as string | undefined,
            successCount: 0,
            failCount: 0,
          };
        })
        .filter((proxy: Proxy) => proxy.port > 0 && proxy.port <= 65535);
    } catch {
      return [];
    }
  };
}

// ============================================================================
// Proxy Manager Class
// ============================================================================

export class ProxyManager {
  private pool: ProxyPool | null = null;
  private cachePath: string;
  private cacheTtlMs: number;

  constructor(cachePath?: string, cacheTtlMs?: number) {
    this.cachePath = cachePath || PROXY_CACHE_PATH;
    this.cacheTtlMs = cacheTtlMs || PROXY_CACHE_TTL_MS;
  }

  /**
   * Load proxy pool from cache or fetch new proxies
   */
  async load(): Promise<ProxyPool> {
    // Try to load from cache
    try {
      const raw = await readFile(this.cachePath, "utf-8");
      const cached = JSON.parse(raw) as ProxyPool;
      const age = Date.now() - new Date(cached.lastUpdated).getTime();

      if (age < this.cacheTtlMs && cached.proxies.length > 0) {
        console.log(`[proxy] Loaded ${cached.proxies.length} proxies from cache`);
        this.pool = cached;
        return this.pool;
      }
    } catch {
      // Cache miss or invalid
    }

    // Fetch new proxies
    await this.refresh();
    return this.pool!;
  }

  /**
   * Fetch fresh proxies from all sources
   */
  async refresh(): Promise<void> {
    console.log("[proxy] Fetching fresh proxies from sources...");
    const allProxies: Proxy[] = [];

    for (const source of PROXY_SOURCES) {
      try {
        console.log(`[proxy] Fetching from ${source.name}...`);
        const response = await fetch(source.url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
          console.log(`[proxy] ${source.name} failed: ${response.status}`);
          continue;
        }

        const text = await response.text();
        const proxies = source.parser(text);
        const limited = proxies.slice(0, MAX_PROXIES_PER_SOURCE);
        console.log(
          `[proxy] ${source.name}: got ${proxies.length} proxies, using ${limited.length}`,
        );
        allProxies.push(...limited);

        if (allProxies.length >= MAX_TOTAL_PROXIES) {
          console.log(`[proxy] Reached max limit (${MAX_TOTAL_PROXIES}), stopping fetch`);
          break;
        }
      } catch (error) {
        console.log(
          `[proxy] ${source.name} error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const unique = new Map<string, Proxy>();
    for (const proxy of allProxies) {
      const key = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
      if (!unique.has(key)) {
        unique.set(key, proxy);
      }
    }

    this.pool = {
      proxies: Array.from(unique.values()).slice(0, MAX_TOTAL_PROXIES),
      lastUpdated: new Date().toISOString(),
      currentIndex: 0,
    };

    console.log(`[proxy] Total unique proxies: ${this.pool.proxies.length}`);
    await this.save();
  }

  async validate(): Promise<void> {
    if (!this.pool || this.pool.proxies.length === 0) {
      console.log("[proxy] No proxies to validate");
      return;
    }

    console.log(`[proxy] Validating up to ${MAX_PROXIES_TO_TEST} proxies...`);
    const working: Proxy[] = [];
    const toTest = this.pool.proxies.slice(0, MAX_PROXIES_TO_TEST);

    for (const proxy of toTest) {
      const isWorking = await this.testProxyConnectivity(proxy);
      if (isWorking) {
        proxy.successCount++;
        working.push(proxy);
        console.log(`[proxy] ✓ ${proxy.host}:${proxy.port} working`);
      } else {
        proxy.failCount++;
      }
    }

    working.sort((a, b) => b.successCount - a.failCount - (a.successCount - b.failCount));

    this.pool.proxies = working;
    this.pool.currentIndex = 0;

    console.log(`[proxy] Validation complete: ${working.length}/${toTest.length} working`);
    await this.save();
  }

  private async testProxyConnectivity(proxy: Proxy): Promise<boolean> {
    if (proxy.protocol !== "http" && proxy.protocol !== "https") {
      return false;
    }

    return new Promise((resolve) => {
      const req = http.request({
        host: proxy.host,
        port: proxy.port,
        method: "CONNECT",
        path: "i.instagram.com:443",
        timeout: PROXY_TEST_TIMEOUT_MS,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "*/*",
          Connection: "keep-alive",
        },
      });

      req.on("connect", (_res, socket) => {
        socket.destroy();
        resolve(true);
      });

      req.on("error", () => resolve(false));
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  /**
   * Get next available proxy (round-robin)
   */
  getNextProxy(): Proxy | null {
    if (!this.pool || this.pool.proxies.length === 0) {
      return null;
    }

    const proxy = this.pool.proxies[this.pool.currentIndex];
    this.pool.currentIndex = (this.pool.currentIndex + 1) % this.pool.proxies.length;

    return proxy;
  }

  /**
   * Get all available proxies
   */
  getAllProxies(): Proxy[] {
    return this.pool?.proxies || [];
  }

  /**
   * Get proxy count
   */
  getProxyCount(): number {
    return this.pool?.proxies.length || 0;
  }

  /**
   * Mark proxy as failed
   */
  markFailed(proxy: Proxy): void {
    proxy.failCount++;
    // Remove if too many failures
    if (proxy.failCount >= 3 && this.pool) {
      this.pool.proxies = this.pool.proxies.filter(
        (p) => !(p.host === proxy.host && p.port === proxy.port),
      );
    }
  }

  /**
   * Mark proxy as successful
   */
  markSuccess(proxy: Proxy): void {
    proxy.successCount++;
  }

  /**
   * Convert proxy to URL string
   */
  static toUrl(proxy: Proxy, includeAuth?: boolean): string {
    return `${proxy.protocol}://${proxy.host}:${proxy.port}`;
  }

  /**
   * Save pool to cache
   */
  private async save(): Promise<void> {
    try {
      await mkdir(dirname(this.cachePath), { recursive: true });
      await writeFile(this.cachePath, JSON.stringify(this.pool, null, 2), "utf-8");
    } catch (error) {
      console.log(`[proxy] Failed to save cache: ${error}`);
    }
  }
}

export async function testProxy(proxy: Proxy): Promise<boolean> {
  if (proxy.protocol !== "http" && proxy.protocol !== "https") {
    return false;
  }

  return new Promise((resolve) => {
    const req = http.request({
      host: proxy.host,
      port: proxy.port,
      method: "CONNECT",
      path: "httpbin.org:443",
      timeout: PROXY_TEST_TIMEOUT_MS,
    });

    req.on("connect", (_res, socket) => {
      socket.destroy();
      resolve(true);
    });

    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}
