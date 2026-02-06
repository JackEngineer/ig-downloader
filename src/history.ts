/**
 * Download History / Deduplication
 *
 * Tracks downloaded videos by Instagram shortCode per user.
 * Persists to a JSON file alongside config.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname, resolve } from "path";
import { homedir } from "os";

// ============================================================================
// Types
// ============================================================================

export interface DownloadRecord {
  shortCode: string;
  /** Local file path where the video was saved */
  filePath: string;
  /** Caption used for filename */
  caption?: string;
  /** ISO date string of when this was downloaded */
  downloadedAt: string;
  /** File size in bytes */
  size?: number;
}

export interface UserHistory {
  username: string;
  downloads: DownloadRecord[];
}

interface HistoryData {
  users: Record<string, UserHistory>;
}

// ============================================================================
// History Manager
// ============================================================================

const DEFAULT_HISTORY_PATH = resolve(homedir(), ".ig-downloader", "history.json");

export class HistoryManager {
  private historyPath: string;
  private data: HistoryData | null = null;

  constructor(historyPath?: string) {
    this.historyPath = historyPath || DEFAULT_HISTORY_PATH;
  }

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.historyPath, "utf-8");
      this.data = JSON.parse(raw);
    } catch {
      this.data = { users: {} };
    }
  }

  async save(): Promise<void> {
    if (!this.data) throw new Error("History not loaded. Call load() first.");
    await mkdir(dirname(this.historyPath), { recursive: true });
    await writeFile(this.historyPath, JSON.stringify(this.data, null, 2), "utf-8");
  }

  private ensureUser(username: string): UserHistory {
    if (!this.data) throw new Error("History not loaded.");
    if (!this.data.users[username]) {
      this.data.users[username] = { username, downloads: [] };
    }
    return this.data.users[username];
  }

  /**
   * Check if a video has already been downloaded for a user.
   */
  isDownloaded(username: string, shortCode: string): boolean {
    if (!this.data) throw new Error("History not loaded.");
    const user = this.data.users[username];
    if (!user) return false;
    return user.downloads.some((d) => d.shortCode === shortCode);
  }

  /**
   * Record a successful download.
   */
  addRecord(username: string, record: Omit<DownloadRecord, "downloadedAt">): void {
    const user = this.ensureUser(username);
    // Avoid duplicate records for same shortCode
    if (user.downloads.some((d) => d.shortCode === record.shortCode)) return;
    user.downloads.push({
      ...record,
      downloadedAt: new Date().toISOString(),
    });
  }

  /**
   * Get download stats for a user.
   */
  getUserStats(username: string): { totalDownloads: number; totalSize: number } {
    if (!this.data) throw new Error("History not loaded.");
    const user = this.data.users[username];
    if (!user) return { totalDownloads: 0, totalSize: 0 };
    const totalSize = user.downloads.reduce((sum, d) => sum + (d.size || 0), 0);
    return { totalDownloads: user.downloads.length, totalSize };
  }

  /**
   * Get all downloaded shortCodes for a user (for fast filtering).
   */
  getDownloadedShortCodes(username: string): Set<string> {
    if (!this.data) throw new Error("History not loaded.");
    const user = this.data.users[username];
    if (!user) return new Set();
    return new Set(user.downloads.map((d) => d.shortCode));
  }

  /**
   * Get overall stats across all users.
   */
  getGlobalStats(): { totalUsers: number; totalDownloads: number; totalSize: number } {
    if (!this.data) throw new Error("History not loaded.");
    let totalDownloads = 0;
    let totalSize = 0;
    const totalUsers = Object.keys(this.data.users).length;
    for (const user of Object.values(this.data.users)) {
      totalDownloads += user.downloads.length;
      totalSize += user.downloads.reduce((sum, d) => sum + (d.size || 0), 0);
    }
    return { totalUsers, totalDownloads, totalSize };
  }
}
