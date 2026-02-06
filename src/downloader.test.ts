import { describe, it, expect, vi } from "vitest";
import { sanitizeFilename, type DownloadTask } from "./downloader.js";

describe("sanitizeFilename", () => {
  it("should return shortCode when caption is empty", () => {
    expect(sanitizeFilename("", "ABC123")).toBe("ABC123");
  });

  it("should return shortCode when caption is only whitespace", () => {
    expect(sanitizeFilename("   ", "ABC123")).toBe("ABC123");
  });

  it("should remove emojis from caption", () => {
    const caption = "Hello World 😊🔥";
    const result = sanitizeFilename(caption, "ABC123");

    expect(result).not.toContain("😊");
    expect(result).not.toContain("🔥");
    expect(result).toContain("Hello_World");
  });

  it("should remove hashtags", () => {
    const caption = "Great video #awesome #viral";
    const result = sanitizeFilename(caption, "ABC123");

    expect(result).not.toContain("#awesome");
    expect(result).not.toContain("#viral");
    expect(result).toContain("Great_video");
  });

  it("should remove @mentions", () => {
    const caption = "Thanks @user and @friend";
    const result = sanitizeFilename(caption, "ABC123");

    expect(result).not.toContain("@user");
    expect(result).not.toContain("@friend");
  });

  it("should replace unsafe filesystem characters with underscore", () => {
    const caption = "File/Name:With?Illegal*Chars";
    const result = sanitizeFilename(caption, "ABC123");

    expect(result).not.toMatch(/[/\\:*?"<>|]/);
  });

  it("should collapse multiple spaces/underscores", () => {
    const caption = "Too    many     spaces";
    const result = sanitizeFilename(caption, "ABC123");

    expect(result).not.toContain("    ");
  });

  it("should remove leading/trailing underscores", () => {
    const caption = "_Leading and trailing_";
    const result = sanitizeFilename(caption, "ABC123");

    expect(result).not.toMatch(/^_|[._]$/);
  });

  it("should append shortCode for uniqueness", () => {
    const caption = "Nice video";
    const result = sanitizeFilename(caption, "ABC123");

    expect(result).toBe("Nice_video_ABC123");
  });

  it("should truncate long captions", () => {
    const longCaption = "a".repeat(200);
    const result = sanitizeFilename(longCaption, "ABC123");

    expect(result.length).toBeLessThanOrEqual(100);
    expect(result.endsWith("_ABC123")).toBe(true);
  });

  it("should handle real Instagram captions", () => {
    const caption =
      "Amazing sunset at the beach! 🌅 #sunset #beach #vacation @traveler";
    const result = sanitizeFilename(caption, "XYZ789");

    expect(result).toContain("Amazing_sunset_at_the_beach");
    expect(result.endsWith("_XYZ789")).toBe(true);
    expect(result).not.toContain("#");
    expect(result).not.toContain("@");
    expect(result).not.toContain("🌅");
  });
});

describe("DownloadTask type", () => {
  it("should have correct structure", () => {
    const task: DownloadTask = {
      videoUrl: "https://example.com/video.mp4",
      username: "testuser",
      shortCode: "ABC123",
      caption: "Test video",
    };

    expect(task.videoUrl).toBe("https://example.com/video.mp4");
    expect(task.username).toBe("testuser");
    expect(task.shortCode).toBe("ABC123");
    expect(task.caption).toBe("Test video");
  });

  it("should allow optional caption", () => {
    const task: DownloadTask = {
      videoUrl: "https://example.com/video.mp4",
      username: "testuser",
      shortCode: "ABC123",
    };

    expect(task.caption).toBeUndefined();
  });
});
