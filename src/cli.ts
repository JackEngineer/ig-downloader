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
    log.error("Usage: ig-downloader add <username> [--max-videos 20] [--note \"description\"]");
    process.exit(1);
  }

  const maxVideosRaw = args.flags["max-videos"] || args.flags["max-video"];
  const maxVideos = maxVideosRaw ? Number(maxVideosRaw) : undefined;
  const note = typeof args.flags["note"] === "string" ? args.flags["note"] : undefined;

  const user = config.addUser(username, { maxVideos, note });
  if (!user) {
    log.warn(`User @${username.replace(/^@/, "").toLowerCase()} is already tracked.`);
    return;
  }

  await config.save();
  log.success(`Added @${user.username} to tracked users.`);
  if (maxVideos) log.dim(`  Max videos: ${maxVideos}`);
  if (note) log.dim(`  Note: ${note}`);
}

async function cmdRemove(config: ConfigManager, args: ParsedArgs): Promise<void> {
  const username = args.positional[0];
  if (!username) {
    log.error("Usage: ig-downloader remove <username>");
    process.exit(1);
  }

  const removed = config.removeUser(username);
  if (!removed) {
    log.warn(`User @${username.replace(/^@/, "").toLowerCase()} is not tracked.`);
    return;
  }

  await config.save();
  log.success(`Removed @${username.replace(/^@/, "").toLowerCase()} from tracked users.`);
}

async function cmdEnable(config: ConfigManager, args: ParsedArgs): Promise<void> {
  const username = args.positional[0];
  if (!username) {
    log.error("Usage: ig-downloader enable <username>");
    process.exit(1);
  }

  if (!config.toggleUser(username, true)) {
    log.warn(`User @${username.replace(/^@/, "").toLowerCase()} is not tracked.`);
    return;
  }

  await config.save();
  log.success(`Enabled @${username.replace(/^@/, "").toLowerCase()}.`);
}

async function cmdDisable(config: ConfigManager, args: ParsedArgs): Promise<void> {
  const username = args.positional[0];
  if (!username) {
    log.error("Usage: ig-downloader disable <username>");
    process.exit(1);
  }

  if (!config.toggleUser(username, false)) {
    log.warn(`User @${username.replace(/^@/, "").toLowerCase()} is not tracked.`);
    return;
  }

  await config.save();
  log.success(`Disabled @${username.replace(/^@/, "").toLowerCase()}.`);
}

async function cmdList(config: ConfigManager, history: HistoryManager): Promise<void> {
  const users = config.get().users;
  if (users.length === 0) {
    log.info("No tracked users. Use 'ig-downloader add <username>' to start tracking.");
    return;
  }

  log.header("Tracked Users");

  const rows: string[][] = [["Username", "Status", "Max", "Downloads", "Size", "Note"]];

  for (const user of users) {
    const stats = history.getUserStats(user.username);
    rows.push([
      `@${user.username}`,
      user.enabled ? "✔ enabled" : "✖ disabled",
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
    log.header("Current Configuration");
    const cfg = config.get();
    log.dim(`Config file:    ${config.getConfigPath()}`);
    log.dim(`Download dir:   ${cfg.downloadDir}`);
    log.dim(`Max videos:     ${cfg.maxVideosPerUser}`);
    log.dim(`Scroll timeout: ${cfg.scrollTimeout}ms`);
    log.dim(`Schedule:       ${cfg.schedule}`);
    log.dim(`Tracked users:  ${cfg.users.length}`);
    return;
  }

  if (!value) {
    log.error(`Usage: ig-downloader config <setting> <value>`);
    log.dim("Settings: download-dir, max-videos, scroll-timeout, schedule");
    process.exit(1);
  }

  switch (setting) {
    case "download-dir":
      config.setDownloadDir(value);
      await config.save();
      log.success(`Download directory set to: ${resolve(value)}`);
      break;
    case "max-videos":
      config.setMaxVideos(Number(value));
      await config.save();
      log.success(`Max videos per user set to: ${value}`);
      break;
    case "scroll-timeout":
      config.get().scrollTimeout = Number(value);
      await config.save();
      log.success(`Scroll timeout set to: ${value}ms`);
      break;
    case "schedule":
      config.setSchedule(value);
      await config.save();
      log.success(`Schedule set to: ${value}`);
      break;
    default:
      log.error(`Unknown setting: ${setting}`);
      log.dim("Available: download-dir, max-videos, scroll-timeout, schedule");
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
      log.error(`User @${targetUsername.replace(/^@/, "").toLowerCase()} is not tracked. Add with: ig-downloader add ${targetUsername}`);
      process.exit(1);
    }
    usersToProcess = [user];
  } else {
    usersToProcess = config.getEnabledUsers();
  }

  if (usersToProcess.length === 0) {
    log.warn("No enabled users to process. Add users with: ig-downloader add <username>");
    return;
  }

  log.header(`Instagram Video Downloader`);
  log.info(`Processing ${usersToProcess.length} user(s)...`);
  log.dim(`Download dir: ${cfg.downloadDir}`);
  if (dryRun) log.warn("DRY RUN — no files will be downloaded.");

  const extractor = new InstagramExtractor();
  await extractor.initialize();
  log.success("Browser initialized.");

  let globalDownloaded = 0;
  let globalFailed = 0;
  let globalSkipped = 0;
  let globalSize = 0;

  try {
    for (const user of usersToProcess) {
      const maxVideos = user.maxVideos || cfg.maxVideosPerUser;

      log.header(`@${user.username}`);
      log.step(`Collecting reel links (max: ${maxVideos})...`);

      const reelLinks = await extractor.collectReelLinks(user.username, maxVideos, cfg.scrollTimeout);
      if (reelLinks.length === 0) {
        log.warn(`No reel links found for @${user.username}. Instagram may require login.`);
        continue;
      }

      log.info(`Found ${reelLinks.length} reel(s). Checking for new videos...`);

      const downloadedCodes = history.getDownloadedShortCodes(user.username);
      const newLinks = reelLinks.filter((link) => {
        const code = extractShortCode(link);
        return code && !downloadedCodes.has(code);
      });

      if (newLinks.length === 0) {
        log.success(`All videos already downloaded for @${user.username}.`);
        globalSkipped += reelLinks.length;
        continue;
      }

      log.info(`${newLinks.length} new video(s) to download (${reelLinks.length - newLinks.length} already downloaded).`);
      globalSkipped += reelLinks.length - newLinks.length;

      if (dryRun) {
        for (const link of newLinks) {
          log.dim(`  Would download: ${link}`);
        }
        continue;
      }

      log.step("Extracting video URLs...");

      const tasks: DownloadTask[] = [];
      for (let i = 0; i < newLinks.length; i++) {
        const link = newLinks[i];
        const shortCode = extractShortCode(link);
        if (!shortCode) continue;

        log.progress(i + 1, newLinks.length, `Extracting ${shortCode}...`);

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
          log.warn(`Failed to extract video from ${link}: ${result.error || "unknown"}`);
          globalFailed++;
        }
      }

      if (tasks.length === 0) {
        log.warn(`No videos could be extracted for @${user.username}.`);
        continue;
      }

      log.step(`Downloading ${tasks.length} video(s)...`);

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
        log.success(`Downloaded ${downloaded.length} video(s) for @${user.username} (${log.formatSize(downloaded.reduce((s, d) => s + (d.size || 0), 0))})`);
      }
      if (failed.length > 0) {
        log.warn(`${failed.length} download(s) failed for @${user.username}:`);
        for (const f of failed) {
          log.dim(`  ${f.shortCode}: ${f.error}`);
        }
      }
    }
  } finally {
    await extractor.close();
  }

  log.header("Summary");
  log.dim(`Downloaded: ${globalDownloaded} video(s) (${log.formatSize(globalSize)})`);
  log.dim(`Skipped:   ${globalSkipped} (already downloaded)`);
  log.dim(`Failed:    ${globalFailed}`);
}

async function cmdStats(history: HistoryManager): Promise<void> {
  const stats = history.getGlobalStats();
  log.header("Download Statistics");
  log.dim(`Total users tracked:     ${stats.totalUsers}`);
  log.dim(`Total videos downloaded:  ${stats.totalDownloads}`);
  log.dim(`Total size:              ${log.formatSize(stats.totalSize)}`);
}

async function cmdCron(config: ConfigManager): Promise<void> {
  const cfg = config.get();
  const scriptPath = resolve(process.argv[1] || "ig-downloader");

  log.header("Cron Setup");
  log.info("Add this line to your crontab (run: crontab -e):");
  console.log();
  console.log(`  ${cfg.schedule} cd ${resolve(".")} && node ${scriptPath} run >> ~/ig-downloader.log 2>&1`);
  console.log();
  log.dim(`Current schedule: ${cfg.schedule}`);
  log.dim("Change with: ig-downloader config schedule \"0 3 * * *\"");
}

function showHelp(): void {
  console.log(`
  ig-downloader — Automated Instagram video downloader

  USAGE
    ig-downloader <command> [options]

  COMMANDS
    add <username>         Track a new Instagram user
      --max-videos <n>       Override max videos for this user
      --note <text>          Add a note/label

    remove <username>      Stop tracking a user
    enable <username>      Enable a disabled user
    disable <username>     Disable a user without removing

    list                   Show all tracked users with stats

    run [username]         Download new videos
      --dry-run              Show what would be downloaded without downloading

    config                 Show current configuration
    config <key> <value>   Update a setting
      download-dir           Base download directory
      max-videos             Default max videos per user
      scroll-timeout         Scroll timeout in ms
      schedule               Cron expression

    stats                  Show global download statistics
    cron                   Show crontab setup instructions
    help                   Show this help message

  EXAMPLES
    ig-downloader add natgeo --note "National Geographic"
    ig-downloader add bbcnews --max-videos 5
    ig-downloader run                  # Download all enabled users
    ig-downloader run natgeo           # Download specific user only
    ig-downloader run --dry-run        # Preview without downloading
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
      log.error(`Unknown command: ${args.command}`);
      showHelp();
      process.exit(1);
  }
}

main().catch((error) => {
  log.error(`Fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
