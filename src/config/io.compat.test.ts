import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { createConfigIO } from "./io.js";

async function withTempHome(run: (home: string) => Promise<void>): Promise<void> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "thinkfleet-config-"));
  try {
    await run(home);
  } finally {
    await fs.rm(home, { recursive: true, force: true });
  }
}

async function writeConfig(
  home: string,
  dirname: string,
  port: number,
  filename: string = "thinkfleet.json",
) {
  const dir = path.join(home, dirname);
  await fs.mkdir(dir, { recursive: true });
  const configPath = path.join(dir, filename);
  await fs.writeFile(configPath, JSON.stringify({ gateway: { port } }, null, 2));
  return configPath;
}

describe("config io compat", () => {
  it("loads config from ~/.thinkfleet/thinkfleet.json", async () => {
    await withTempHome(async (home) => {
      const configPath = await writeConfig(home, ".thinkfleet", 19001);

      const io = createConfigIO({
        env: {} as NodeJS.ProcessEnv,
        homedir: () => home,
      });
      expect(io.configPath).toBe(configPath);
      expect(io.loadConfig().gateway?.port).toBe(19001);
    });
  });

  it("returns empty config when no config file exists", async () => {
    await withTempHome(async (home) => {
      const io = createConfigIO({
        env: {} as NodeJS.ProcessEnv,
        homedir: () => home,
      });

      const cfg = io.loadConfig();
      expect(cfg.gateway?.port).toBeUndefined();
    });
  });

  it("honors explicit config path env override", async () => {
    await withTempHome(async (home) => {
      await writeConfig(home, ".thinkfleet", 19002);
      const overridePath = await writeConfig(home, "custom-config", 20002);

      const io = createConfigIO({
        env: { THINKFLEET_CONFIG_PATH: overridePath } as NodeJS.ProcessEnv,
        homedir: () => home,
      });

      expect(io.configPath).toBe(overridePath);
      expect(io.loadConfig().gateway?.port).toBe(20002);
    });
  });

  it("uses STATE_DIR override for config path", async () => {
    await withTempHome(async (home) => {
      const customStateDir = path.join(home, "custom-state");
      const configPath = await writeConfig(home, "custom-state", 30001);

      const io = createConfigIO({
        env: { THINKFLEET_STATE_DIR: customStateDir } as NodeJS.ProcessEnv,
        homedir: () => home,
      });

      expect(io.configPath).toBe(configPath);
      expect(io.loadConfig().gateway?.port).toBe(30001);
    });
  });

  it("config path env override takes precedence over state dir", async () => {
    await withTempHome(async (home) => {
      const customStateDir = path.join(home, "custom-state");
      await writeConfig(home, "custom-state", 30001);
      const explicitPath = await writeConfig(home, "explicit", 40001);

      const io = createConfigIO({
        env: {
          THINKFLEET_STATE_DIR: customStateDir,
          THINKFLEET_CONFIG_PATH: explicitPath,
        } as NodeJS.ProcessEnv,
        homedir: () => home,
      });

      expect(io.configPath).toBe(explicitPath);
      expect(io.loadConfig().gateway?.port).toBe(40001);
    });
  });
});
