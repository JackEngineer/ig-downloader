import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { log } from "./logger.js";

describe("Logger", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("info", () => {
    it("should log info message with blue indicator", () => {
      log.info("Test message");

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Test message"));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("ℹ"));
    });
  });

  describe("success", () => {
    it("should log success message with green checkmark", () => {
      log.success("Success message");

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Success message"));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("✔"));
    });
  });

  describe("warn", () => {
    it("should log warning message with yellow indicator", () => {
      log.warn("Warning message");

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Warning message"));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("⚠"));
    });
  });

  describe("error", () => {
    it("should log error message with red indicator to stderr", () => {
      log.error("Error message");

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Error message"));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("✖"));
    });
  });

  describe("step", () => {
    it("should log step message with arrow indicator", () => {
      log.step("Step message");

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Step message"));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("→"));
    });
  });

  describe("header", () => {
    it("should log header with decorative lines", () => {
      log.header("Test Header");

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Test Header"));
    });
  });

  describe("dim", () => {
    it("should log dimmed message", () => {
      log.dim("Dimmed message");

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Dimmed message"));
    });
  });

  describe("progress", () => {
    it("should add newline when progress completes", () => {
      log.progress(100, 100, "Done");

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("table", () => {
    it("should format table rows", () => {
      const rows = [
        ["Name", "Value"],
        ["Item1", "100"],
        ["Item2", "200"],
      ];

      log.table(rows);

      expect(consoleLogSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it("should handle empty rows", () => {
      log.table([]);

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe("formatSize", () => {
    it("should format bytes", () => {
      expect(log.formatSize(500)).toBe("500 B");
    });

    it("should format kilobytes", () => {
      expect(log.formatSize(1500)).toBe("1.5 KB");
    });

    it("should format megabytes", () => {
      expect(log.formatSize(5 * 1024 * 1024)).toBe("5.00 MB");
    });

    it("should format gigabytes", () => {
      expect(log.formatSize(2 * 1024 * 1024 * 1024)).toBe("2.00 GB");
    });

    it("should handle zero", () => {
      expect(log.formatSize(0)).toBe("0 B");
    });
  });
});
