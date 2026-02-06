/**
 * 视频下载器
 *
 * 处理：
 * - 从 CDN URL 下载视频文件（带重试）
 * - 组织到用户特定目录
 * - 基于标题/短代码命名文件
 */

import { writeFile, mkdir, stat } from "fs/promises";
import { join } from "path";

// ============================================================================
// Constants
// ============================================================================

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const DOWNLOAD_BATCH_SIZE = 3;
const MAX_FILENAME_LENGTH = 80;

// ============================================================================
// Types
// ============================================================================

export interface DownloadTask {
  videoUrl: string;
  username: string;
  shortCode: string;
  caption?: string;
}

export interface DownloadResult {
  success: boolean;
  shortCode: string;
  filePath: string;
  size?: number;
  sizeFormatted?: string;
  error?: string;
  caption?: string;
}

// ============================================================================
// Filename Sanitization
// ============================================================================

/**
 * Create a safe filename from a caption string.
 * Falls back to shortCode if caption is empty/unusable.
 */
export function sanitizeFilename(caption: string | undefined, shortCode: string): string {
  if (!caption || caption.trim().length === 0) {
    return shortCode;
  }

  let name = caption
    // Remove emojis
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}]/gu, "")
    // Remove hashtags
    .replace(/#\S+/g, "")
    // Remove @mentions
    .replace(/@\S+/g, "")
    // Replace filesystem-unsafe characters
    .replace(/[/\\:*?"<>|]/g, "_")
    // Collapse multiple spaces/underscores
    .replace(/[\s_]+/g, "_")
    // Remove leading/trailing underscores and dots
    .replace(/^[_.\s]+|[_.\s]+$/g, "")
    .trim();

  if (name.length === 0) {
    return shortCode;
  }

  // Truncate to max length, keeping shortCode suffix for uniqueness
  if (name.length > MAX_FILENAME_LENGTH) {
    name = name.substring(0, MAX_FILENAME_LENGTH).replace(/_+$/, "");
  }

  // Append shortCode for uniqueness
  return `${name}_${shortCode}`;
}

// ============================================================================
// Download Functions
// ============================================================================

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  baseDelay: number = RETRY_BASE_DELAY_MS
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError ?? new Error("All retry attempts failed");
}

/**
 * Download a single video file.
 */
async function downloadFile(videoUrl: string, outputPath: string): Promise<{ size: number }> {
  const buffer = await withRetry(async () => {
    const response = await fetch(videoUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://www.instagram.com/",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      throw new Error("Empty response body");
    }

    return Buffer.from(arrayBuffer);
  });

  await mkdir(dirname_safe(outputPath), { recursive: true });
  await writeFile(outputPath, buffer);

  const stats = await stat(outputPath);
  return { size: stats.size };
}

function dirname_safe(filePath: string): string {
  const idx = filePath.lastIndexOf("/");
  if (idx <= 0) return ".";
  return filePath.substring(0, idx);
}

/**
 * Download a single video task, organizing into user directory.
 */
export async function downloadVideo(
  task: DownloadTask,
  baseDir: string
): Promise<DownloadResult> {
  const filename = sanitizeFilename(task.caption, task.shortCode) + ".mp4";
  const userDir = join(baseDir, task.username);
  const filePath = join(userDir, filename);

  try {
    await mkdir(userDir, { recursive: true });
    const { size } = await downloadFile(task.videoUrl, filePath);

    return {
      success: true,
      shortCode: task.shortCode,
      filePath,
      size,
      sizeFormatted: `${(size / 1024 / 1024).toFixed(2)} MB`,
      caption: task.caption,
    };
  } catch (error) {
    return {
      success: false,
      shortCode: task.shortCode,
      filePath,
      error: `Download failed: ${error instanceof Error ? error.message : String(error)}`,
      caption: task.caption,
    };
  }
}

/**
 * Download multiple videos in batches to avoid rate limiting.
 */
export async function batchDownload(
  tasks: DownloadTask[],
  baseDir: string,
  onProgress?: (completed: number, total: number, result: DownloadResult) => void
): Promise<{ downloaded: DownloadResult[]; failed: DownloadResult[] }> {
  const downloaded: DownloadResult[] = [];
  const failed: DownloadResult[] = [];
  let completed = 0;

  for (let i = 0; i < tasks.length; i += DOWNLOAD_BATCH_SIZE) {
    const batch = tasks.slice(i, i + DOWNLOAD_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((task) => downloadVideo(task, baseDir))
    );

    for (const result of results) {
      completed++;
      if (result.status === "fulfilled") {
        if (result.value.success) {
          downloaded.push(result.value);
        } else {
          failed.push(result.value);
        }
        onProgress?.(completed, tasks.length, result.value);
      } else {
        const failResult: DownloadResult = {
          success: false,
          shortCode: "unknown",
          filePath: "unknown",
          error: result.reason?.message || "Unknown error",
        };
        failed.push(failResult);
        onProgress?.(completed, tasks.length, failResult);
      }
    }
  }

  return { downloaded, failed };
}
