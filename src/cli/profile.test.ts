import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatCliCommand } from "./command-format.js";
import { applyCliProfileEnv, parseCliProfileArgs } from "./profile.js";

describe("parseCliProfileArgs", () => {
  it("leaves gateway --dev for subcommands", () => {
    const res = parseCliProfileArgs([
      "node",
      "thinkfleet",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
    if (!res.ok) throw new Error(res.error);
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "thinkfleet", "gateway", "--dev", "--allow-unconfigured"]);
  });

  it("still accepts global --dev before subcommand", () => {
    const res = parseCliProfileArgs(["node", "thinkfleet", "--dev", "gateway"]);
    if (!res.ok) throw new Error(res.error);
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "thinkfleet", "gateway"]);
  });

  it("parses --profile value and strips it", () => {
    const res = parseCliProfileArgs(["node", "thinkfleet", "--profile", "work", "status"]);
    if (!res.ok) throw new Error(res.error);
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "thinkfleet", "status"]);
  });

  it("rejects missing profile value", () => {
    const res = parseCliProfileArgs(["node", "thinkfleet", "--profile"]);
    expect(res.ok).toBe(false);
  });

  it("rejects combining --dev with --profile (dev first)", () => {
    const res = parseCliProfileArgs(["node", "thinkfleet", "--dev", "--profile", "work", "status"]);
    expect(res.ok).toBe(false);
  });

  it("rejects combining --dev with --profile (profile first)", () => {
    const res = parseCliProfileArgs(["node", "thinkfleet", "--profile", "work", "--dev", "status"]);
    expect(res.ok).toBe(false);
  });
});

describe("applyCliProfileEnv", () => {
  it("fills env defaults for dev profile", () => {
    const env: Record<string, string | undefined> = {};
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    const expectedStateDir = path.join("/home/peter", ".thinkfleet-dev");
    expect(env.THINKFLEET_PROFILE).toBe("dev");
    expect(env.THINKFLEET_STATE_DIR).toBe(expectedStateDir);
    expect(env.THINKFLEET_CONFIG_PATH).toBe(path.join(expectedStateDir, "thinkfleet.json"));
    expect(env.THINKFLEET_GATEWAY_PORT).toBe("19001");
  });

  it("does not override explicit env values", () => {
    const env: Record<string, string | undefined> = {
      THINKFLEET_STATE_DIR: "/custom",
      THINKFLEET_GATEWAY_PORT: "19099",
    };
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    expect(env.THINKFLEET_STATE_DIR).toBe("/custom");
    expect(env.THINKFLEET_GATEWAY_PORT).toBe("19099");
    expect(env.THINKFLEET_CONFIG_PATH).toBe(path.join("/custom", "thinkfleet.json"));
  });
});

describe("formatCliCommand", () => {
  it("returns command unchanged when no profile is set", () => {
    expect(formatCliCommand("thinkfleet-engine doctor --fix", {})).toBe(
      "thinkfleet-engine doctor --fix",
    );
  });

  it("returns command unchanged when profile is default", () => {
    expect(
      formatCliCommand("thinkfleet-engine doctor --fix", { THINKFLEET_PROFILE: "default" }),
    ).toBe("thinkfleet-engine doctor --fix");
  });

  it("returns command unchanged when profile is Default (case-insensitive)", () => {
    expect(
      formatCliCommand("thinkfleet-engine doctor --fix", { THINKFLEET_PROFILE: "Default" }),
    ).toBe("thinkfleet-engine doctor --fix");
  });

  it("returns command unchanged when profile is invalid", () => {
    expect(
      formatCliCommand("thinkfleet-engine doctor --fix", { THINKFLEET_PROFILE: "bad profile" }),
    ).toBe("thinkfleet-engine doctor --fix");
  });

  it("returns command unchanged when --profile is already present", () => {
    expect(
      formatCliCommand("thinkfleet-engine --profile work doctor --fix", {
        THINKFLEET_PROFILE: "work",
      }),
    ).toBe("thinkfleet-engine --profile work doctor --fix");
  });

  it("returns command unchanged when --dev is already present", () => {
    expect(formatCliCommand("thinkfleet-engine --dev doctor", { THINKFLEET_PROFILE: "dev" })).toBe(
      "thinkfleet-engine --dev doctor",
    );
  });

  it("inserts --profile flag when profile is set", () => {
    expect(formatCliCommand("thinkfleet-engine doctor --fix", { THINKFLEET_PROFILE: "work" })).toBe(
      "thinkfleet-engine --profile work doctor --fix",
    );
  });

  it("trims whitespace from profile", () => {
    expect(
      formatCliCommand("thinkfleet-engine doctor --fix", { THINKFLEET_PROFILE: "  jbclawd  " }),
    ).toBe("thinkfleet-engine --profile jbclawd doctor --fix");
  });

  it("handles command with no args after thinkfleet-engine", () => {
    expect(formatCliCommand("thinkfleet-engine", { THINKFLEET_PROFILE: "test" })).toBe(
      "thinkfleet-engine --profile test",
    );
  });

  it("handles pnpm wrapper", () => {
    expect(formatCliCommand("pnpm thinkfleet-engine doctor", { THINKFLEET_PROFILE: "work" })).toBe(
      "pnpm thinkfleet-engine --profile work doctor",
    );
  });

  it("normalizes legacy thinkfleet command to thinkfleet-engine", () => {
    expect(formatCliCommand("thinkfleet doctor --fix", {})).toBe("thinkfleet-engine doctor --fix");
  });
});
