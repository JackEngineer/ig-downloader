/**
 * Cron 时间配置向导
 *
 * 提供交互式界面，让用户通过问答方式配置定时任务，
 * 自动生成对应的 cron 表达式。
 */

import * as readline from "readline";

// ============================================================================
// Types
// ============================================================================

export type FrequencyType = "daily" | "weekly" | "hourly" | "minutes" | "custom";

export interface CronConfig {
  frequency: FrequencyType;
  cronExpression: string;
  description: string;
}

interface MenuOption {
  key: string;
  label: string;
  value: FrequencyType;
}

// ============================================================================
// Constants
// ============================================================================

const WEEKDAYS = [
  { value: 1, label: "星期一" },
  { value: 2, label: "星期二" },
  { value: 3, label: "星期三" },
  { value: 4, label: "星期四" },
  { value: 5, label: "星期五" },
  { value: 6, label: "星期六" },
  { value: 7, label: "星期日" },
];

const FREQUENCY_OPTIONS: MenuOption[] = [
  { key: "1", label: "每天运行", value: "daily" },
  { key: "2", label: "每周运行", value: "weekly" },
  { key: "3", label: "每小时运行", value: "hourly" },
  { key: "4", label: "每 X 分钟运行", value: "minutes" },
  { key: "5", label: "自定义 cron 表达式", value: "custom" },
];

// ============================================================================
// Helper Functions
// ============================================================================

function createInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function askQuestion(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function validateHour(hour: string): number | null {
  const h = parseInt(hour, 10);
  if (isNaN(h) || h < 0 || h > 23) return null;
  return h;
}

function validateMinute(minute: string): number | null {
  const m = parseInt(minute, 10);
  if (isNaN(m) || m < 0 || m > 59) return null;
  return m;
}

function validateWeekday(day: string): number | null {
  const d = parseInt(day, 10);
  if (isNaN(d) || d < 1 || d > 7) return null;
  return d;
}

function validateInterval(minutes: string): number | null {
  const m = parseInt(minutes, 10);
  if (isNaN(m) || m < 1 || m > 59) return null;
  return m;
}

function formatTime(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function formatCronDescription(cron: string): string {
  const parts = cron.split(" ");
  if (parts.length !== 5) return cron;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // 每天
  if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*" && hour !== "*") {
    return `每天 ${formatTime(parseInt(hour), parseInt(minute))}`;
  }

  // 每小时
  if (hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return `每小时的第 ${minute} 分钟`;
  }

  // 每周
  if (dayOfMonth === "*" && month === "*" && dayOfWeek !== "*") {
    const weekday =
      WEEKDAYS.find((w) => w.value.toString() === dayOfWeek)?.label || `星期${dayOfWeek}`;
    return `每周${weekday} ${formatTime(parseInt(hour), parseInt(minute))}`;
  }

  // 每 X 分钟
  if (minute.startsWith("*/") && hour === "*") {
    const interval = minute.replace("*/", "");
    return `每 ${interval} 分钟`;
  }

  return cron;
}

// ============================================================================
// Configuration Handlers
// ============================================================================

async function configureDaily(rl: readline.Interface): Promise<CronConfig | null> {
  console.log("\n📅 每天运行配置");
  console.log("━━━━━━━━━━━━━━━━");

  let hour: number | null = null;
  while (hour === null) {
    const answer = await askQuestion(rl, "请输入小时 (0-23): ");
    hour = validateHour(answer);
    if (hour === null) {
      console.log("❌ 无效的小时，请输入 0-23 之间的数字");
    }
  }

  let minute: number | null = null;
  while (minute === null) {
    const answer = await askQuestion(rl, "请输入分钟 (0-59): ");
    minute = validateMinute(answer);
    if (minute === null) {
      console.log("❌ 无效的分钟，请输入 0-59 之间的数字");
    }
  }

  const cron = `${minute} ${hour} * * *`;
  return {
    frequency: "daily",
    cronExpression: cron,
    description: `每天 ${formatTime(hour, minute)} 运行`,
  };
}

async function configureWeekly(rl: readline.Interface): Promise<CronConfig | null> {
  console.log("\n📆 每周运行配置");
  console.log("━━━━━━━━━━━━━━━━");

  console.log("请选择星期几:");
  WEEKDAYS.forEach((day) => {
    console.log(`  ${day.value}. ${day.label}`);
  });

  let weekday: number | null = null;
  while (weekday === null) {
    const answer = await askQuestion(rl, "请输入数字 (1-7): ");
    weekday = validateWeekday(answer);
    if (weekday === null) {
      console.log("❌ 无效的选择，请输入 1-7 之间的数字");
    }
  }

  let hour: number | null = null;
  while (hour === null) {
    const answer = await askQuestion(rl, "请输入小时 (0-23): ");
    hour = validateHour(answer);
    if (hour === null) {
      console.log("❌ 无效的小时，请输入 0-23 之间的数字");
    }
  }

  let minute: number | null = null;
  while (minute === null) {
    const answer = await askQuestion(rl, "请输入分钟 (0-59): ");
    minute = validateMinute(answer);
    if (minute === null) {
      console.log("❌ 无效的分钟，请输入 0-59 之间的数字");
    }
  }

  const dayLabel = WEEKDAYS.find((w) => w.value === weekday)?.label || "";
  const cron = `${minute} ${hour} * * ${weekday}`;
  return {
    frequency: "weekly",
    cronExpression: cron,
    description: `每周${dayLabel} ${formatTime(hour, minute)} 运行`,
  };
}

async function configureHourly(rl: readline.Interface): Promise<CronConfig | null> {
  console.log("\n🕐 每小时运行配置");
  console.log("━━━━━━━━━━━━━━━━");

  let minute: number | null = null;
  while (minute === null) {
    const answer = await askQuestion(rl, "请输入每小时的第几分钟运行 (0-59): ");
    minute = validateMinute(answer);
    if (minute === null) {
      console.log("❌ 无效的分钟，请输入 0-59 之间的数字");
    }
  }

  const cron = `${minute} * * * *`;
  return {
    frequency: "hourly",
    cronExpression: cron,
    description: `每小时的第 ${minute} 分钟运行`,
  };
}

async function configureMinutes(rl: readline.Interface): Promise<CronConfig | null> {
  console.log("\n⏱️  每 X 分钟运行配置");
  console.log("━━━━━━━━━━━━━━━━━━");

  let interval: number | null = null;
  while (interval === null) {
    const answer = await askQuestion(rl, "请输入间隔分钟数 (1-59): ");
    interval = validateInterval(answer);
    if (interval === null) {
      console.log("❌ 无效的间隔，请输入 1-59 之间的数字");
    }
  }

  const cron = `*/${interval} * * * *`;
  return {
    frequency: "minutes",
    cronExpression: cron,
    description: `每 ${interval} 分钟运行一次`,
  };
}

async function configureCustom(rl: readline.Interface): Promise<CronConfig | null> {
  console.log("\n🔧 自定义 Cron 表达式");
  console.log("━━━━━━━━━━━━━━━━━━━");
  console.log("Cron 格式: 分 时 日 月 星期");
  console.log("示例: 0 3 * * * (每天 3:00)");
  console.log("      */15 * * * * (每 15 分钟)");

  let cron: string | null = null;
  while (cron === null) {
    const answer = await askQuestion(rl, "\n请输入 cron 表达式: ");
    const trimmed = answer.trim();

    // 基本验证：应该是 5 个部分
    const parts = trimmed.split(/\s+/);
    if (parts.length !== 5) {
      console.log("❌ 无效的 cron 表达式，需要有 5 个部分 (分 时 日 月 星期)");
      continue;
    }

    // 简单验证每个部分
    const isValid = parts.every((part) => /^[\d*,/\-]+$/.test(part));
    if (!isValid) {
      console.log("❌ 表达式包含无效字符");
      continue;
    }

    cron = trimmed;
  }

  return {
    frequency: "custom",
    cronExpression: cron,
    description: formatCronDescription(cron),
  };
}

// ============================================================================
// Main Wizard
// ============================================================================

export async function runCronWizard(): Promise<CronConfig | null> {
  const rl = createInterface();

  try {
    console.log("\n🕒 Cron 时间配置向导");
    console.log("━━━━━━━━━━━━━━━━━━━");
    console.log("请按数字键选择运行频率:\n");

    FREQUENCY_OPTIONS.forEach((opt) => {
      console.log(`  ${opt.key}. ${opt.label}`);
    });

    const answer = await askQuestion(rl, "\n请选择 (1-5): ");
    const option = FREQUENCY_OPTIONS.find((opt) => opt.key === answer);

    if (!option) {
      console.log("❌ 无效的选择");
      return null;
    }

    let config: CronConfig | null = null;

    switch (option.value) {
      case "daily":
        config = await configureDaily(rl);
        break;
      case "weekly":
        config = await configureWeekly(rl);
        break;
      case "hourly":
        config = await configureHourly(rl);
        break;
      case "minutes":
        config = await configureMinutes(rl);
        break;
      case "custom":
        config = await configureCustom(rl);
        break;
    }

    if (config) {
      console.log("\n✅ 配置完成!");
      console.log(`   运行频率: ${config.description}`);
      console.log(`   Cron 表达式: ${config.cronExpression}`);
    }

    return config;
  } finally {
    rl.close();
  }
}

export function formatCronHelp(): string {
  return `
Cron 表达式格式说明:
━━━━━━━━━━━━━━━━━━━━

格式: 分 时 日 月 星期

字段说明:
  分      : 0-59
  时      : 0-23
  日      : 1-31
  月      : 1-12
  星期    : 0-7 (0 和 7 都代表星期日)

特殊字符:
  *       : 任意值
  */n     : 每隔 n (如 */15 = 每15分钟)
  n-m     : 范围 (如 9-17 = 9点到17点)
  n,m     : 列表 (如 1,15 = 1号和15号)

常用示例:
  0 3 * * *      → 每天凌晨 3:00
  */15 * * * *   → 每 15 分钟
  0 */6 * * *    → 每 6 小时
  0 9 * * 1      → 每周一上午 9:00
  0 22 * * 1-5   → 工作日晚上 10:00
`;
}
