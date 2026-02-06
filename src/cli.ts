#!/usr/bin/env node

import { ConfigManager, TrackedUser } from "./config.js";
import { HistoryManager } from "./history.js";
import { InstagramExtractor, extractShortCode } from "./extractor.js";
import { batchDownload, DownloadTask } from "./downloader.js";
import { log } from "./logger.js";
import { resolve } from "path";

// ============================================================================
// CLI Argument Parsing
// ============================================================================

interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const command = args[0] || "help";
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const eqIdx = arg.indexOf("=");
      if (eqIdx !== -1) {
        flags[arg.substring(2, eqIdx)] = arg.substring(eqIdx + 1);
      } else if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        flags[arg.substring(2)] = args[i + 1];
        i++;
      } else {
        flags[arg.substring(2)] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { command, positional, flags };
}

// ============================================================================
// Commands
// ============================================================================

async function cmdAdd(config: ConfigManager, args: ParsedArgs): Promise<void> {
  const username = args.positional[0];
  if (!username) {
    log.error("用法: ig-downloader add <用户名> [--max-videos 20] [--note \"描述\"]");
    process.exit(1);
  }

  const maxVideosRaw = args.flags["max-videos"] || args.flags["max-video"];
  const maxVideos = maxVideosRaw ? Number(maxVideosRaw) : undefined;
  const note = typeof args.flags["note"] === "string" ? args.flags["note"] : undefined;

  const user = config.addUser(username, { maxVideos, note });
  if (!user) {
    log.warn(`用户 @${username.replace(/^@/, "").toLowerCase()} 已经在跟踪列表中。`);
    return;
  }

  await config.save();
  log.success(`已将 @${user.username} 添加到跟踪列表。`);
  if (maxVideos) log.dim(`  最大视频数: ${maxVideos}`);
  if (note) log.dim(`  备注: ${note}`);
}

async function cmdRemove(config: ConfigManager, args: ParsedArgs): Promise<void> {
  const username = args.positional[0];
  if (!username) {
    log.error("用法: ig-downloader remove <用户名>");
    process.exit(1);
  }

  const removed = config.removeUser(username);
  if (!removed) {
    log.warn(`用户 @${username.replace(/^@/, "").toLowerCase()} 不在跟踪列表中。`);
    return;
  }

  await config.save();
  log.success(`已将 @${username.replace(/^@/, "").toLowerCase()} 从跟踪列表中移除。`);
}

async function cmdEnable(config: ConfigManager, args: ParsedArgs): Promise<void> {
  const username = args.positional[0];
  if (!username) {
    log.error("用法: ig-downloader enable <用户名>");
    process.exit(1);
  }

  if (!config.toggleUser(username, true)) {
    log.warn(`用户 @${username.replace(/^@/, "").toLowerCase()} 不在跟踪列表中。`);
    return;
  }

  await config.save();
  log.success(`已启用 @${username.replace(/^@/, "").toLowerCase()}。`);
}

async function cmdDisable(config: ConfigManager, args: ParsedArgs): Promise<void> {
  const username = args.positional[0];
  if (!username) {
    log.error("用法: ig-downloader disable <用户名>");
    process.exit(1);
  }

  if (!config.toggleUser(username, false)) {
    log.warn(`用户 @${username.replace(/^@/, "").toLowerCase()} 不在跟踪列表中。`);
    return;
  }

  await config.save();
  log.success(`已禁用 @${username.replace(/^@/, "").toLowerCase()}。`);
}

async function cmdList(config: ConfigManager, history: HistoryManager): Promise<void> {
  const users = config.get().users;
  if (users.length === 0) {
    log.info("暂无跟踪用户。使用 'ig-downloader add <用户名>' 开始跟踪。");
    return;
  }

  log.header("跟踪用户列表");

  const rows: string[][] = [["用户名", "状态", "最大视频数", "已下载", "大小", "备注"]];

  for (const user of users) {
    const stats = history.getUserStats(user.username);
    rows.push([
      `@${user.username}`,
      user.enabled ? "✔ 已启用" : "✖ 已禁用",
      String(user.maxVideos || config.get().maxVideosPerUser),
      String(stats.totalDownloads),
      log.formatSize(stats.totalSize),
      user.note || "",
    ]);
  }

  log.table(rows);
}

async function cmdConfig(config: ConfigManager, args: ParsedArgs): Promise<void> {
  const setting = args.positional[0];
  const value = args.positional[1];

  if (!setting) {
    log.header("当前配置");
    const cfg = config.get();
    log.dim(`配置文件:     ${config.getConfigPath()}`);
    log.dim(`下载目录:     ${cfg.downloadDir}`);
    log.dim(`最大视频数:   ${cfg.maxVideosPerUser}`);
    log.dim(`滚动超时:     ${cfg.scrollTimeout}ms`);
    log.dim(`定时计划:     ${cfg.schedule}`);
    log.dim(`跟踪用户数:   ${cfg.users.length}`);
    return;
  }

  if (!value) {
    log.error(`用法: ig-downloader config <设置项> <值>`);
    log.dim("设置项: download-dir, max-videos, scroll-timeout, schedule");
    process.exit(1);
  }

  switch (setting) {
    case "download-dir":
      config.setDownloadDir(value);
      await config.save();
      log.success(`下载目录已设置为: ${resolve(value)}`);
      break;
    case "max-videos":
      config.setMaxVideos(Number(value));
      await config.save();
      log.success(`每用户最大视频数已设置为: ${value}`);
      break;
    case "scroll-timeout":
      config.get().scrollTimeout = Number(value);
      await config.save();
      log.success(`滚动超时已设置为: ${value}ms`);
      break;
    case "schedule":
      config.setSchedule(value);
      await config.save();
      log.success(`定时计划已设置为: ${value}`);
      break;
    default:
      log.error(`未知设置项: ${setting}`);
      log.dim("可用项: download-dir, max-videos, scroll-timeout, schedule");
      process.exit(1);
  }
}

async function cmdRun(
  config: ConfigManager,
  history: HistoryManager,
  args: ParsedArgs
): Promise<void> {
  const targetUsername = args.positional[0];
  const dryRun = args.flags["dry-run"] === true;
  const cfg = config.get();

  let usersToProcess: TrackedUser[];
  if (targetUsername) {
    const user = config.findUser(targetUsername);
    if (!user) {
      log.error(`用户 @${targetUsername.replace(/^@/, "").toLowerCase()} 不在跟踪列表中。请先添加: ig-downloader add ${targetUsername}`);
      process.exit(1);
    }
    usersToProcess = [user];
  } else {
    usersToProcess = config.getEnabledUsers();
  }

  if (usersToProcess.length === 0) {
    log.warn("没有启用的用户可处理。使用 ig-downloader add <用户名> 添加用户。");
    return;
  }

  log.header(`Instagram 视频下载器`);
  log.info(`正在处理 ${usersToProcess.length} 个用户...`);
  log.dim(`下载目录: ${cfg.downloadDir}`);
  if (dryRun) log.warn("模拟运行 — 不会实际下载文件。");

  const extractor = new InstagramExtractor();
  await extractor.initialize();
  log.success("浏览器已初始化。");

  let globalDownloaded = 0;
  let globalFailed = 0;
  let globalSkipped = 0;
  let globalSize = 0;

  try {
    for (const user of usersToProcess) {
      const maxVideos = user.maxVideos || cfg.maxVideosPerUser;

      log.header(`@${user.username}`);
      log.step(`正在收集 Reel 链接 (最大: ${maxVideos})...`);

      const reelLinks = await extractor.collectReelLinks(user.username, maxVideos, cfg.scrollTimeout);
      if (reelLinks.length === 0) {
        log.warn(`未找到 @${user.username} 的 Reel 链接。Instagram 可能需要登录。`);
        continue;
      }

      log.info(`找到 ${reelLinks.length} 个 Reel。正在检查新视频...`);

      const downloadedCodes = history.getDownloadedShortCodes(user.username);
      const newLinks = reelLinks.filter((link) => {
        const code = extractShortCode(link);
        return code && !downloadedCodes.has(code);
      });

      if (newLinks.length === 0) {
        log.success(`@${user.username} 的所有视频已下载完毕。`);
        globalSkipped += reelLinks.length;
        continue;
      }

      log.info(`${newLinks.length} 个新视频待下载 (${reelLinks.length - newLinks.length} 个已下载过)。`);
      globalSkipped += reelLinks.length - newLinks.length;

      if (dryRun) {
        for (const link of newLinks) {
          log.dim(`  将下载: ${link}`);
        }
        continue;
      }

      log.step("正在提取视频链接...");

      const tasks: DownloadTask[] = [];
      for (let i = 0; i < newLinks.length; i++) {
        const link = newLinks[i];
        const shortCode = extractShortCode(link);
        if (!shortCode) continue;

        log.progress(i + 1, newLinks.length, `正在提取 ${shortCode}...`);

        const result = await extractor.extractFromPost(link);
        if (result.success && result.videos.length > 0) {
          const best = result.videos[0];
          tasks.push({
            videoUrl: best.url,
            username: user.username,
            shortCode: best.shortCode || shortCode,
            caption: best.caption,
          });
        } else {
          log.warn(`无法从 ${link} 提取视频: ${result.error || "未知错误"}`);
          globalFailed++;
        }
      }

      if (tasks.length === 0) {
        log.warn(`无法为 @${user.username} 提取任何视频。`);
        continue;
      }

      log.step(`正在下载 ${tasks.length} 个视频...`);

      const { downloaded, failed } = await batchDownload(
        tasks,
        cfg.downloadDir,
        (completed, total, result) => {
          if (result.success) {
            log.progress(completed, total, `${result.sizeFormatted} — ${result.shortCode}`);
          }
        }
      );

      for (const d of downloaded) {
        history.addRecord(user.username, {
          shortCode: d.shortCode,
          filePath: d.filePath,
          caption: d.caption,
          size: d.size,
        });
      }
      await history.save();

      globalDownloaded += downloaded.length;
      globalFailed += failed.length;
      globalSize += downloaded.reduce((sum, d) => sum + (d.size || 0), 0);

      if (downloaded.length > 0) {
        log.success(`已为 @${user.username} 下载 ${downloaded.length} 个视频 (${log.formatSize(downloaded.reduce((s, d) => s + (d.size || 0), 0))})`);
      }
      if (failed.length > 0) {
        log.warn(`${failed.length} 个视频下载失败 @${user.username}:`);
        for (const f of failed) {
          log.dim(`  ${f.shortCode}: ${f.error}`);
        }
      }
    }
  } finally {
    await extractor.close();
  }

  log.header("汇总");
  log.dim(`已下载: ${globalDownloaded} 个视频 (${log.formatSize(globalSize)})`);
  log.dim(`已跳过: ${globalSkipped} 个 (已下载过)`);
  log.dim(`失败:   ${globalFailed}`);
}

async function cmdStats(history: HistoryManager): Promise<void> {
  const stats = history.getGlobalStats();
  log.header("下载统计");
  log.dim(`跟踪用户总数:     ${stats.totalUsers}`);
  log.dim(`已下载视频总数:   ${stats.totalDownloads}`);
  log.dim(`总大小:           ${log.formatSize(stats.totalSize)}`);
}

async function cmdCron(config: ConfigManager): Promise<void> {
  const cfg = config.get();
  const scriptPath = resolve(process.argv[1] || "ig-downloader");

  log.header("定时任务设置");
  log.info("将以下行添加到 crontab (运行: crontab -e):");
  console.log();
  console.log(`  ${cfg.schedule} cd ${resolve(".")} && node ${scriptPath} run >> ~/ig-downloader.log 2>&1`);
  console.log();
  log.dim(`当前计划: ${cfg.schedule}`);
  log.dim("修改命令: ig-downloader config schedule \"0 3 * * *\"");
}

function showHelp(): void {
  console.log(`
  ig-downloader — 自动 Instagram 视频下载器

  用法
    ig-downloader <命令> [选项]

  命令
    add <用户名>           跟踪新的 Instagram 用户
      --max-videos <n>       为此用户设置最大视频数
      --note <文本>          添加备注/标签

    remove <用户名>        停止跟踪用户
    enable <用户名>        启用已禁用的用户
    disable <用户名>       禁用用户而不删除

    list                   显示所有跟踪用户及其统计信息

    run [用户名]           下载新视频
      --dry-run              预览将要下载的内容而不实际下载

    config                 显示当前配置
    config <键> <值>       更新设置
      download-dir           基础下载目录
      max-videos             每用户默认最大视频数
      scroll-timeout         滚动超时时间（毫秒）
      schedule               Cron 表达式

    stats                  显示全局下载统计
    cron                   显示 crontab 设置说明
    help                   显示此帮助信息

  示例
    ig-downloader add natgeo --note "国家地理"
    ig-downloader add bbcnews --max-videos 5
    ig-downloader run                  # 下载所有启用用户
    ig-downloader run natgeo           # 仅下载特定用户
    ig-downloader run --dry-run        # 预览而不下载
    ig-downloader config download-dir ~/Videos/Instagram
    ig-downloader config schedule "0 8,20 * * *"
  `);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const config = new ConfigManager();
  await config.load();

  const history = new HistoryManager();
  await history.load();

  switch (args.command) {
    case "add":
      await cmdAdd(config, args);
      break;
    case "remove":
    case "rm":
      await cmdRemove(config, args);
      break;
    case "enable":
      await cmdEnable(config, args);
      break;
    case "disable":
      await cmdDisable(config, args);
      break;
    case "list":
    case "ls":
      await cmdList(config, history);
      break;
    case "config":
    case "cfg":
      await cmdConfig(config, args);
      break;
    case "run":
      await cmdRun(config, history, args);
      break;
    case "stats":
      await cmdStats(history);
      break;
    case "cron":
      await cmdCron(config);
      break;
    case "help":
    case "--help":
    case "-h":
      showHelp();
      break;
    default:
      log.error(`未知命令: ${args.command}`);
      showHelp();
      process.exit(1);
  }
}

main().catch((error) => {
  log.error(`致命错误: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
