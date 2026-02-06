/**
 * Cron 任务自动安装器
 *
 * 自动管理系统的 crontab，实现定时任务的安装、卸载和查看。
 */

import { exec } from "child_process";
import { promisify } from "util";
import { resolve } from "path";
import { log } from "./logger.js";

const execAsync = promisify(exec);

// ============================================================================
// Constants
// ============================================================================

const CRON_COMMENT = "# ig-downloader auto-generated job";
const CRON_END_COMMENT = "# ig-downloader end";

// ============================================================================
// Helper Functions
// ============================================================================

function buildCronCommand(schedule: string, scriptPath: string, workDir: string): string {
  return `${schedule} cd ${workDir} && node ${scriptPath} run >> ~/ig-downloader.log 2>&1`;
}

// ============================================================================
// Public API
// ============================================================================

export interface CronStatus {
  installed: boolean;
  currentCrontab: string;
  ourJob?: string;
}

/**
 * 获取当前 crontab 状态
 */
export async function getCronStatus(): Promise<CronStatus> {
  try {
    const { stdout } = await execAsync("crontab -l");
    const currentCrontab = stdout.toString();
    const lines = currentCrontab.split("\n");

    // 查找我们的任务
    let ourJob: string | undefined;
    let inOurBlock = false;

    for (const line of lines) {
      if (line.includes(CRON_COMMENT)) {
        inOurBlock = true;
      } else if (line.includes(CRON_END_COMMENT)) {
        inOurBlock = false;
      } else if (inOurBlock && line.trim() && !line.startsWith("#")) {
        ourJob = line.trim();
        inOurBlock = false;
      }
    }

    return {
      installed: !!ourJob,
      currentCrontab,
      ourJob,
    };
  } catch {
    // crontab -l 会失败如果用户没有 crontab
    return {
      installed: false,
      currentCrontab: "",
      ourJob: undefined,
    };
  }
}

/**
 * 安装 cron 任务
 */
export async function installCronJob(
  schedule: string,
  scriptPath: string,
  workDir: string
): Promise<boolean> {
  const newJob = buildCronCommand(schedule, scriptPath, workDir);
  const status = await getCronStatus();

  let newCrontab: string;

  if (status.installed) {
    // 替换现有任务
    const lines = status.currentCrontab.split("\n");
    const newLines: string[] = [];
    let skipUntilEnd = false;

    for (const line of lines) {
      if (line.includes(CRON_COMMENT)) {
        skipUntilEnd = true;
        // 添加新的任务块
        newLines.push(CRON_COMMENT);
        newLines.push(newJob);
        newLines.push(CRON_END_COMMENT);
      } else if (line.includes(CRON_END_COMMENT)) {
        skipUntilEnd = false;
      } else if (!skipUntilEnd) {
        newLines.push(line);
      }
    }

    newCrontab = newLines.join("\n");
    log.info("已更新现有的定时任务");
  } else {
    // 添加新任务
    const jobBlock = `${CRON_COMMENT}\n${newJob}\n${CRON_END_COMMENT}`;
    newCrontab = status.currentCrontab
      ? `${status.currentCrontab.trim()}\n\n${jobBlock}\n`
      : `${jobBlock}\n`;
    log.info("已创建新的定时任务");
  }

  try {
    // 使用 echo 和 crontab - 来安装
    const escapedCrontab = newCrontab.replace(/"/g, '\\"');
    await execAsync(`echo "${escapedCrontab}" | crontab -`);
    return true;
  } catch (error) {
    log.error(`安装 crontab 失败: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * 卸载 cron 任务
 */
export async function uninstallCronJob(): Promise<boolean> {
  const status = await getCronStatus();

  if (!status.installed) {
    log.warn("没有找到已安装的定时任务");
    return true;
  }

  const lines = status.currentCrontab.split("\n");
  const newLines: string[] = [];
  let inOurBlock = false;

  for (const line of lines) {
    if (line.includes(CRON_COMMENT)) {
      inOurBlock = true;
    } else if (line.includes(CRON_END_COMMENT)) {
      inOurBlock = false;
    } else if (!inOurBlock) {
      newLines.push(line);
    }
  }

  // 清理多余的空行
  const cleanedCrontab = newLines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  try {
    if (cleanedCrontab) {
      const escapedCrontab = cleanedCrontab.replace(/"/g, '\\"');
      await execAsync(`echo "${escapedCrontab}" | crontab -`);
    } else {
      // 如果 crontab 为空，直接移除
      await execAsync("crontab -r");
    }
    log.success("已卸载定时任务");
    return true;
  } catch (error) {
    log.error(`卸载 crontab 失败: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * 显示 cron 任务状态
 */
export function displayCronStatus(status: CronStatus, schedule: string): void {
  log.header("定时任务状态");

  if (status.installed && status.ourJob) {
    log.success("✅ 定时任务已安装");
    log.dim(`   当前任务: ${status.ourJob}`);

    // 解析并显示计划
    const parts = status.ourJob.split(" ");
    if (parts.length >= 5) {
      const cronPart = parts.slice(0, 5).join(" ");
      log.dim(`   Cron 表达式: ${cronPart}`);
    }
  } else {
    log.warn("⚠️  定时任务未安装");
    log.info("   运行 'ig-downloader install-cron' 来安装自动运行");
    log.dim(`   当前配置的计划: ${schedule}`);
  }
}
