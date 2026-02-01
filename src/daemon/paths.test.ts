import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveGatewayStateDir } from "./paths.js";

describe("resolveGatewayStateDir", () => {
  it("uses the default state dir when no overrides are set", () => {
    const env = { HOME: "/Users/test" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".thinkfleet"));
  });

  it("appends the profile suffix when set", () => {
    const env = { HOME: "/Users/test", THINKFLEET_PROFILE: "rescue" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".thinkfleet-rescue"));
  });

  it("treats default profiles as the base state dir", () => {
    const env = { HOME: "/Users/test", THINKFLEET_PROFILE: "Default" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".thinkfleet"));
  });

  it("uses THINKFLEET_STATE_DIR when provided", () => {
    const env = { HOME: "/Users/test", THINKFLEET_STATE_DIR: "/var/lib/thinkfleet" };
    expect(resolveGatewayStateDir(env)).toBe(path.resolve("/var/lib/thinkfleet"));
  });

  it("expands ~ in THINKFLEET_STATE_DIR", () => {
    const env = { HOME: "/Users/test", THINKFLEET_STATE_DIR: "~/thinkfleet-state" };
    expect(resolveGatewayStateDir(env)).toBe(path.resolve("/Users/test/thinkfleet-state"));
  });

  it("preserves Windows absolute paths without HOME", () => {
    const env = { THINKFLEET_STATE_DIR: "C:\\State\\thinkfleet" };
    expect(resolveGatewayStateDir(env)).toBe("C:\\State\\thinkfleet");
  });
});
