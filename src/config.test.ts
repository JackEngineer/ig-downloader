import { describe, it, expect } from "vitest";
import { ConfigManager, type TrackedUser, type AppConfig } from "./config.js";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

describe("ConfigManager", () => {
  function withConfig<T>(fn: (config: ConfigManager, tempDir: string) => Promise<T>): () => Promise<T> {
    return async () => {
      const tempDir = mkdtempSync(join(tmpdir(), "ig-downloader-test-"));
      const config = new ConfigManager(join(tempDir, `config-${Date.now()}-${Math.random()}.json`));
      try {
        await config.load();
        return await fn(config, tempDir);
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    };
  }

  describe("load", () => {
    it("should load default config when file does not exist", withConfig(async (config) => {
      const cfg = await config.load();
      expect(cfg.downloadDir).toBeDefined();
      expect(cfg.maxVideosPerUser).toBe(20);
      expect(cfg.users).toEqual([]);
    }));

    it("should load existing config", async () => {
      const tempDir = mkdtempSync(join(tmpdir(), "ig-downloader-test-"));
      const configPath = join(tempDir, "config.json");
      
      const customConfig: AppConfig = {
        downloadDir: "/custom/path",
        maxVideosPerUser: 50,
        scrollTimeout: 60000,
        schedule: "0 12 * * *",
        users: [
          {
            username: "testuser",
            enabled: true,
            addedAt: "2024-01-01",
            maxVideos: 30,
            note: "Test note",
          },
        ],
      };

      const fs = await import("fs/promises");
      await fs.mkdir(tempDir, { recursive: true });
      await fs.writeFile(configPath, JSON.stringify(customConfig), "utf-8");

      const config = new ConfigManager(configPath);
      const cfg = await config.load();

      expect(cfg.downloadDir).toBe("/custom/path");
      expect(cfg.maxVideosPerUser).toBe(50);
      expect(cfg.users).toHaveLength(1);
      expect(cfg.users[0].username).toBe("testuser");
      
      rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe("save", () => {
    it("should save config to file", withConfig(async (config, tempDir) => {
      config.setMaxVideos(100);
      await config.save();

      const fs = await import("fs/promises");
      const files = await fs.readdir(tempDir);
      const configFile = files.find(f => f.startsWith("config-"));
      const savedContent = await fs.readFile(join(tempDir, configFile!), "utf-8");
      const saved = JSON.parse(savedContent) as AppConfig;

      expect(saved.maxVideosPerUser).toBe(100);
    }));

    it("should throw if load not called", async () => {
      const tempDir = mkdtempSync(join(tmpdir(), "ig-downloader-test-"));
      const config = new ConfigManager(join(tempDir, "config.json"));

      await expect(config.save()).rejects.toThrow("Config not loaded");
      
      rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe("addUser", () => {
    it("should add a new user", withConfig(async (config) => {
      const user = config.addUser("testuser");
      expect(user).not.toBeNull();
      expect(user?.username).toBe("testuser");
      expect(user?.enabled).toBe(true);
    }));

    it("should normalize username (remove @ and lowercase)", withConfig(async (config) => {
      const user = config.addUser("@TestUser");
      expect(user?.username).toBe("testuser");
    }));

    it("should return null for duplicate user", withConfig(async (config) => {
      config.addUser("testuser");
      const duplicate = config.addUser("testuser");
      expect(duplicate).toBeNull();
    }));

    it("should add user with options", withConfig(async (config) => {
      const user = config.addUser("testuser", {
        maxVideos: 15,
        note: "My favorite user",
      });
      expect(user?.maxVideos).toBe(15);
      expect(user?.note).toBe("My favorite user");
    }));
  });

  describe("removeUser", () => {
    it("should remove existing user", withConfig(async (config) => {
      config.addUser("user1");
      config.addUser("user2");
      const removed = config.removeUser("user1");
      expect(removed).toBe(true);
      expect(config.get().users).toHaveLength(1);
    }));

    it("should return false for non-existent user", withConfig(async (config) => {
      const removed = config.removeUser("nonexistent");
      expect(removed).toBe(false);
    }));

    it("should normalize username", withConfig(async (config) => {
      config.addUser("user1");
      const removed = config.removeUser("@User1");
      expect(removed).toBe(true);
    }));
  });

  describe("toggleUser", () => {
    it("should disable user", withConfig(async (config) => {
      config.addUser("testuser");
      const result = config.toggleUser("testuser", false);
      expect(result).toBe(true);
      expect(config.get().users[0].enabled).toBe(false);
    }));

    it("should enable user", withConfig(async (config) => {
      config.addUser("testuser");
      config.toggleUser("testuser", false);
      const result = config.toggleUser("testuser", true);
      expect(result).toBe(true);
      expect(config.get().users[0].enabled).toBe(true);
    }));

    it("should return false for non-existent user", withConfig(async (config) => {
      const result = config.toggleUser("nonexistent", false);
      expect(result).toBe(false);
    }));
  });

  describe("getEnabledUsers", () => {
    it("should return only enabled users", withConfig(async (config) => {
      config.addUser("enabled1");
      config.addUser("enabled2");
      config.addUser("disabled");
      config.toggleUser("disabled", false);

      const enabled = config.getEnabledUsers();
      expect(enabled).toHaveLength(2);
      expect(enabled.every((u: TrackedUser) => u.enabled)).toBe(true);
    }));
  });

  describe("findUser", () => {
    it("should find existing user", withConfig(async (config) => {
      config.addUser("testuser");
      const user = config.findUser("testuser");
      expect(user).toBeDefined();
      expect(user?.username).toBe("testuser");
    }));

    it("should normalize username", withConfig(async (config) => {
      config.addUser("testuser");
      const user = config.findUser("@TestUser");
      expect(user).toBeDefined();
    }));

    it("should return undefined for non-existent user", withConfig(async (config) => {
      const user = config.findUser("nonexistent");
      expect(user).toBeUndefined();
    }));
  });

  describe("setting updates", () => {
    it("should set download directory", withConfig(async (config) => {
      config.setDownloadDir("/new/path");
      expect(config.get().downloadDir).toBe("/new/path");
    }));

    it("should set max videos", withConfig(async (config) => {
      config.setMaxVideos(100);
      expect(config.get().maxVideosPerUser).toBe(100);
    }));

    it("should set schedule", withConfig(async (config) => {
      config.setSchedule("0 12 * * 1");
      expect(config.get().schedule).toBe("0 12 * * 1");
    }));
  });
});
