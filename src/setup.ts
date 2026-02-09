import { existsSync } from "fs";
import { resolve, join, dirname } from "path";
import { homedir } from "os";
import { log, printSmallFiglet, CYAN, RED } from "./logger.js";

export interface SetupStatus {
  isFirstTime: boolean;
  hasConfig: boolean;
  hasUsers: boolean;
  hasCookies: boolean;
  configPath: string;
  downloadDir: string;
}

export async function checkSetupStatus(
  configPath: string,
  downloadDir: string,
  hasUsers: boolean,
  hasCookies: boolean,
): Promise<SetupStatus> {
  const hasConfig = existsSync(configPath);

  return {
    isFirstTime: !hasConfig && !hasUsers,
    hasConfig,
    hasUsers,
    hasCookies,
    configPath,
    downloadDir,
  };
}

export function showWelcome(): void {
  console.log();
  printSmallFiglet("IGD", CYAN);
  console.log();
  log.success("欢迎使用 Instagram 视频下载器！");
  console.log();
  console.log("  这是一个强大的 Instagram 视频自动下载工具，支持:");
  console.log("  • 多用户跟踪和批量下载");
  console.log("  • 智能去重和断点续传");
  console.log("  • 定时任务自动运行");
  console.log("  • Cookie 认证绕过登录墙");
  console.log();
  log.step("首次使用需要完成以下设置:");
  console.log();
}

export function showQuickStart(): void {
  log.header("快速开始指南");
  console.log();
  log.step("1. 导入 Instagram Cookie（解决登录限制）");
  log.dim("   igd config import-cookies ~/cookies.txt");
  console.log();
  log.step("2. 添加要跟踪的用户");
  log.dim("   igd add <用户名> --max-videos 10");
  console.log();
  log.step("3. 查看配置和用户列表");
  log.dim("   igd config    # 查看配置");
  log.dim("   igd list      # 查看用户列表");
  console.log();
  log.step("4. 运行下载");
  log.dim("   igd run       # 下载所有启用用户的视频");
  log.dim("   igd run <用户> # 下载特定用户");
  log.dim("   igd run --dry-run  # 预览模式（不实际下载）");
  console.log();
  log.info("更多命令请查看: igd --help");
  console.log();
}

export function showSetupWizard(status: SetupStatus): void {
  showWelcome();

  if (!status.hasCookies) {
    showCookieGuide();
  }

  if (!status.hasUsers) {
    showAddUserGuide();
  }

  showQuickStart();
}

export function showCookieGuide(): void {
  log.header("🔐 Cookie 认证设置（重要！）");
  console.log();
  log.warn("Instagram 大多数内容需要登录才能访问");
  console.log();
  log.info("如何获取 Cookie:");
  console.log("  1. 在浏览器中登录 instagram.com");
  console.log('  2. 安装扩展 "Get cookies.txt LOCALLY"（Chrome 商店）');
  console.log("  3. 导出 instagram.com 的 cookies 为 .txt 文件");
  console.log("  4. 使用以下命令导入:");
  console.log();
  log.dim(`  igd config import-cookies ~/Downloads/cookies.txt`);
  console.log();
  log.info("支持的格式: Netscape (.txt) 或 JSON (.json)");
  console.log();
}

export function showAddUserGuide(): void {
  log.header("👤 添加跟踪用户");
  console.log();
  log.info("添加要下载视频的 Instagram 用户:");
  console.log();
  log.dim('  igd add <用户名> [--max-videos N] [--note "备注"]');
  console.log();
  log.info("示例:");
  log.dim('  igd add natgeo --max-videos 10 --note "国家地理"');
  log.dim('  igd add bbcnews --note "BBC新闻"');
  console.log();
}

export function showBrowserInstallGuide(): void {
  log.header("🌐 浏览器安装");
  console.log();
  log.error("Playwright 浏览器未安装");
  console.log();
  log.info("请运行以下命令安装:");
  console.log();
  log.dim("  npx playwright install chromium");
  console.log();
  log.info("或者如果你使用 npm 全局安装:");
  log.dim("  npm install -g playwright && npx playwright install chromium");
  console.log();
  log.warn("安装完成后请重新运行命令");
  console.log();
}

export function isBrowserError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes("executable doesn't exist") ||
    message.includes("failed to launch") ||
    message.includes("browser") ||
    message.includes("chromium")
  );
}

export interface ErrorSolution {
  title: string;
  description: string;
  commands?: string[];
  tips?: string[];
}

export function getErrorSolution(error: Error): ErrorSolution | null {
  const message = error.message.toLowerCase();

  if (isBrowserError(error)) {
    return {
      title: "浏览器未安装",
      description: "Playwright 需要下载浏览器才能运行",
      commands: ["npx playwright install chromium"],
      tips: ["安装可能需要几分钟，请耐心等待", "安装完成后请重新运行命令"],
    };
  }

  if (message.includes("timeout") || message.includes("60000ms")) {
    return {
      title: "连接超时",
      description: "页面加载超时，可能是网络问题或需要登录",
      commands: [
        "igd config scroll-timeout 60000  # 增加超时时间",
        "igd config free-proxy off         # 禁用代理",
      ],
      tips: [
        "检查网络连接",
        "如果使用代理，尝试禁用: igd config free-proxy off",
        "导入 Cookie 可能解决登录限制问题",
      ],
    };
  }

  if (message.includes("cookie") || message.includes("invalid cookie")) {
    return {
      title: "Cookie 问题",
      description: "Cookie 格式无效或已过期",
      commands: [
        "igd config clear-cookies                    # 清除旧 cookies",
        "igd config import-cookies ~/cookies.txt     # 重新导入",
      ],
      tips: [
        "确保从浏览器导出的 cookies.txt 格式正确",
        "Cookie 通常有效期为 1-2 周，过期后需要重新导入",
        '使用 Chrome 扩展 "Get cookies.txt LOCALLY" 导出',
      ],
    };
  }

  if (message.includes("proxy") || message.includes("tunnel") || message.includes("err_tunnel")) {
    return {
      title: "代理连接问题",
      description: "代理服务器连接失败或不稳定",
      commands: [
        "igd config free-proxy off          # 禁用免费代理",
        "igd config remove-proxy            # 移除代理设置",
      ],
      tips: [
        "免费代理池不稳定，建议国内用户禁用",
        "如果需要代理，建议使用付费代理服务",
        "检查代理服务器地址是否正确",
      ],
    };
  }

  if (message.includes("net::") || message.includes("failed to fetch")) {
    return {
      title: "网络连接问题",
      description: "无法连接到 Instagram 服务器",
      commands: ["igd config free-proxy off  # 尝试禁用代理"],
      tips: [
        "检查网络连接是否正常",
        "尝试访问 instagram.com 确认网站可用",
        "如果使用 VPN/代理，尝试切换节点",
      ],
    };
  }

  return null;
}

export function showErrorSolution(error: Error): void {
  const solution = getErrorSolution(error);

  if (!solution) {
    log.error(`错误: ${error.message}`);
    console.log();
    log.info("尝试以下通用解决方案:");
    console.log("  1. 检查网络连接");
    console.log("  2. 重新导入 Cookie: igd config import-cookies ~/cookies.txt");
    console.log("  3. 禁用代理: igd config free-proxy off");
    console.log("  4. 查看帮助: igd --help");
    console.log();
    log.dim("如果问题持续，请检查日志或提交 Issue");
    return;
  }

  console.log();
  printSmallFiglet("IGD", RED);
  console.log();
  log.error(`❌ ${solution.title}`);
  console.log();
  log.warn(solution.description);
  console.log();

  if (solution.commands && solution.commands.length > 0) {
    log.step("解决方案:");
    for (const cmd of solution.commands) {
      log.dim(`  ${cmd}`);
    }
    console.log();
  }

  if (solution.tips && solution.tips.length > 0) {
    log.info("提示:");
    for (const tip of solution.tips) {
      console.log(`  • ${tip}`);
    }
    console.log();
  }
}

export function showNoUsersGuide(): void {
  console.log();
  log.warn("还没有添加任何用户！");
  console.log();
  log.info("添加用户开始跟踪:");
  log.dim('  igd add <用户名> [--max-videos N] [--note "备注"]');
  console.log();
  log.info("示例:");
  log.dim('  igd add natgeo --max-videos 10 --note "国家地理官方账号"');
  console.log();
  log.info("查看所有命令:");
  log.dim("  igd --help");
  console.log();
}

export function showNoCookiesWarning(): void {
  console.log();
  log.warn("⚠️  未检测到 Cookie 配置");
  console.log();
  log.info("大多数 Instagram 内容需要登录才能访问");
  log.info("建议导入浏览器 Cookie 以获得最佳体验");
  console.log();
  log.dim("  igd config import-cookies ~/cookies.txt");
  console.log();
  log.info("或查看详细指南:");
  log.dim("  igd config --help");
  console.log();
}

export function showDownloadCompleteGuide(downloaded: number, failed: number): void {
  console.log();

  if (downloaded > 0) {
    log.success(`✅ 成功下载 ${downloaded} 个视频！`);
    console.log();
    log.info("下载的文件保存在配置目录中");
    log.dim("  igd config  # 查看下载目录");
    console.log();
  }

  if (failed > 0) {
    log.warn(`⚠️  ${failed} 个视频下载失败`);
    console.log();
    log.info("可能的解决方案:");
    console.log("  • 检查网络连接");
    console.log("  • 重新导入 Cookie（可能已过期）");
    console.log("  • 稍后重试（Instagram 可能暂时限流）");
    console.log();
  }

  log.info("其他命令:");
  console.log("  igd list      # 查看用户列表和统计");
  console.log("  igd stats     # 查看全局下载统计");
  console.log("  igd config    # 查看或修改配置");
  console.log();
}

export function showConfigCheck(hasCookies: boolean, userCount: number): void {
  log.success("配置检查完成！");
  console.log();

  if (hasCookies) {
    log.success("✅ Cookie 已配置");
  } else {
    log.warn("⚠️  未配置 Cookie（建议添加）");
  }

  if (userCount > 0) {
    log.success(`✅ 已添加 ${userCount} 个用户`);
  } else {
    log.warn("⚠️  还没有添加用户");
  }

  console.log();

  if (!hasCookies || userCount === 0) {
    log.info("下一步:");
    if (!hasCookies) {
      log.dim("  igd config import-cookies ~/cookies.txt");
    }
    if (userCount === 0) {
      log.dim('  igd add <用户名> --note "备注"');
    }
    console.log();
  }
}
