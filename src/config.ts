/**
 * 配置管理
 *
 * 管理存储以下内容的 JSON 配置文件：
 * - 跟踪用户列表（含每用户设置）
 * - 全局下载目录
 * - 每次运行每用户最大视频数
 * - 定时计划（cron 表达式）
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname, resolve } from "path";
import { homedir } from "os";

// ============================================================================
// Types
// ============================================================================

export interface TrackedUser {
  username: string;
  /** Override max videos for this user (falls back to global) */
  maxVideos?: number;
  /** Whether this user is enabled for scheduled downloads */
  enabled: boolean;
  /** ISO date string of when this user was added */
  addedAt: string;
  /** Optional note/label for the user */
  note?: string;
}

export interface AppConfig {
  /** Base directory for all downloads. Each user gets a subdirectory. */
  downloadDir: string;
  /** Default max videos to fetch per user per run */
  maxVideosPerUser: number;
  /** Scroll timeout in ms when collecting reel links */
  scrollTimeout: number;
  /** Cron expression for scheduled runs (for display/crontab generation) */
  schedule: string;
  /** List of tracked Instagram users */
  users: TrackedUser[];
}

// ============================================================================
// Defaults
// ============================================================================

const DEFAULT_CONFIG_PATH = resolve(homedir(), ".ig-downloader", "config.json");

const DEFAULT_CONFIG: AppConfig = {
  downloadDir: resolve(homedir(), "ig-downloads"),
  maxVideosPerUser: 20,
  scrollTimeout: 30000,
  schedule: "0 3 * * *", // Daily at 3 AM
  users: [],
};

// ============================================================================
// Config Manager
// ============================================================================

export class ConfigManager {
  private configPath: string;
  private config: AppConfig | null = null;

  constructor(configPath?: string) {
    this.configPath = configPath || DEFAULT_CONFIG_PATH;
  }

  getConfigPath(): string {
    return this.configPath;
  }

  async load(): Promise<AppConfig> {
    try {
      const raw = await readFile(this.configPath, "utf-8");
      const parsed = JSON.parse(raw);
      this.config = { ...DEFAULT_CONFIG, ...parsed, users: parsed.users || [] };
    } catch {
      this.config = { ...DEFAULT_CONFIG, users: [] };
    }
    return this.config!;
  }

  async save(): Promise<void> {
    if (!this.config) throw new Error("Config not loaded. Call load() first.");
    await mkdir(dirname(this.configPath), { recursive: true });
    await writeFile(this.configPath, JSON.stringify(this.config, null, 2), "utf-8");
  }

  get(): AppConfig {
    if (!this.config) throw new Error("Config not loaded. Call load() first.");
    return this.config;
  }

  // ==========================================================================
  // User Management
  // ==========================================================================

  addUser(username: string, options?: { maxVideos?: number; note?: string }): TrackedUser | null {
    const config = this.get();
    const normalized = username.replace(/^@/, "").toLowerCase();

    if (config.users.some((u) => u.username === normalized)) {
      return null; // Already exists
    }

    const user: TrackedUser = {
      username: normalized,
      maxVideos: options?.maxVideos,
      enabled: true,
      addedAt: new Date().toISOString(),
      note: options?.note,
    };

    config.users.push(user);
    return user;
  }

  removeUser(username: string): boolean {
    const config = this.get();
    const normalized = username.replace(/^@/, "").toLowerCase();
    const idx = config.users.findIndex((u) => u.username === normalized);
    if (idx === -1) return false;
    config.users.splice(idx, 1);
    return true;
  }

  toggleUser(username: string, enabled: boolean): boolean {
    const config = this.get();
    const normalized = username.replace(/^@/, "").toLowerCase();
    const user = config.users.find((u) => u.username === normalized);
    if (!user) return false;
    user.enabled = enabled;
    return true;
  }

  getEnabledUsers(): TrackedUser[] {
    return this.get().users.filter((u) => u.enabled);
  }

  findUser(username: string): TrackedUser | undefined {
    const normalized = username.replace(/^@/, "").toLowerCase();
    return this.get().users.find((u) => u.username === normalized);
  }

  // ==========================================================================
  // Setting updates
  // ==========================================================================

  setDownloadDir(dir: string): void {
    this.get().downloadDir = resolve(dir);
  }

  setMaxVideos(max: number): void {
    this.get().maxVideosPerUser = max;
  }

  setSchedule(cron: string): void {
    this.get().schedule = cron;
  }
}
