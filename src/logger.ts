/**
 * 日志记录器
 *
 * 简单的彩色控制台日志，用于 CLI 输出。
 */

// ============================================================================
// ANSI Colors
// ============================================================================

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const CYAN = "\x1b[36m";
const MAGENTA = "\x1b[35m";

// ============================================================================
// Logger
// ============================================================================

export const log = {
  info(msg: string): void {
    console.log(`${BLUE}ℹ${RESET} ${msg}`);
  },

  success(msg: string): void {
    console.log(`${GREEN}✔${RESET} ${msg}`);
  },

  warn(msg: string): void {
    console.log(`${YELLOW}⚠${RESET} ${msg}`);
  },

  error(msg: string): void {
    console.error(`${RED}✖${RESET} ${msg}`);
  },

  step(msg: string): void {
    console.log(`${CYAN}→${RESET} ${msg}`);
  },

  header(msg: string): void {
    console.log(`\n${BOLD}${MAGENTA}${msg}${RESET}`);
    console.log(`${DIM}${"─".repeat(Math.min(msg.length + 4, 60))}${RESET}`);
  },

  dim(msg: string): void {
    console.log(`${DIM}  ${msg}${RESET}`);
  },

  progress(current: number, total: number, msg: string): void {
    const pct = Math.round((current / total) * 100);
    const bar = "█".repeat(Math.floor(pct / 5)) + "░".repeat(20 - Math.floor(pct / 5));
    process.stdout.write(`\r  ${bar} ${pct}% ${DIM}${msg}${RESET}`);
    if (current === total) console.log();
  },

  table(rows: string[][]): void {
    if (rows.length === 0) return;

    // Calculate column widths
    const colWidths = rows[0].map((_, colIdx) =>
      Math.max(...rows.map((row) => (row[colIdx] || "").length))
    );

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const line = row
        .map((cell, colIdx) => (cell || "").padEnd(colWidths[colIdx]))
        .join("  ");

      if (i === 0) {
        console.log(`  ${BOLD}${line}${RESET}`);
        console.log(`  ${DIM}${colWidths.map((w) => "─".repeat(w)).join("──")}${RESET}`);
      } else {
        console.log(`  ${line}`);
      }
    }
  },

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  },
};
