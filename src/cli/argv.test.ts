import { describe, expect, it } from "vitest";

import {
  buildParseArgv,
  getFlagValue,
  getCommandPath,
  getPrimaryCommand,
  getPositiveIntFlagValue,
  getVerboseFlag,
  hasHelpOrVersion,
  hasFlag,
  shouldMigrateState,
  shouldMigrateStateFromPath,
} from "./argv.js";

describe("argv helpers", () => {
  it("detects help/version flags", () => {
    expect(hasHelpOrVersion(["node", "thinkfleet", "--help"])).toBe(true);
    expect(hasHelpOrVersion(["node", "thinkfleet", "-V"])).toBe(true);
    expect(hasHelpOrVersion(["node", "thinkfleet", "status"])).toBe(false);
  });

  it("extracts command path ignoring flags and terminator", () => {
    expect(getCommandPath(["node", "thinkfleet", "status", "--json"], 2)).toEqual(["status"]);
    expect(getCommandPath(["node", "thinkfleet", "agents", "list"], 2)).toEqual(["agents", "list"]);
    expect(getCommandPath(["node", "thinkfleet", "status", "--", "ignored"], 2)).toEqual([
      "status",
    ]);
  });

  it("returns primary command", () => {
    expect(getPrimaryCommand(["node", "thinkfleet", "agents", "list"])).toBe("agents");
    expect(getPrimaryCommand(["node", "thinkfleet"])).toBeNull();
  });

  it("parses boolean flags and ignores terminator", () => {
    expect(hasFlag(["node", "thinkfleet", "status", "--json"], "--json")).toBe(true);
    expect(hasFlag(["node", "thinkfleet", "--", "--json"], "--json")).toBe(false);
  });

  it("extracts flag values with equals and missing values", () => {
    expect(getFlagValue(["node", "thinkfleet", "status", "--timeout", "5000"], "--timeout")).toBe(
      "5000",
    );
    expect(getFlagValue(["node", "thinkfleet", "status", "--timeout=2500"], "--timeout")).toBe(
      "2500",
    );
    expect(getFlagValue(["node", "thinkfleet", "status", "--timeout"], "--timeout")).toBeNull();
    expect(getFlagValue(["node", "thinkfleet", "status", "--timeout", "--json"], "--timeout")).toBe(
      null,
    );
    expect(getFlagValue(["node", "thinkfleet", "--", "--timeout=99"], "--timeout")).toBeUndefined();
  });

  it("parses verbose flags", () => {
    expect(getVerboseFlag(["node", "thinkfleet", "status", "--verbose"])).toBe(true);
    expect(getVerboseFlag(["node", "thinkfleet", "status", "--debug"])).toBe(false);
    expect(
      getVerboseFlag(["node", "thinkfleet", "status", "--debug"], { includeDebug: true }),
    ).toBe(true);
  });

  it("parses positive integer flag values", () => {
    expect(getPositiveIntFlagValue(["node", "thinkfleet", "status"], "--timeout")).toBeUndefined();
    expect(
      getPositiveIntFlagValue(["node", "thinkfleet", "status", "--timeout"], "--timeout"),
    ).toBeNull();
    expect(
      getPositiveIntFlagValue(["node", "thinkfleet", "status", "--timeout", "5000"], "--timeout"),
    ).toBe(5000);
    expect(
      getPositiveIntFlagValue(["node", "thinkfleet", "status", "--timeout", "nope"], "--timeout"),
    ).toBeUndefined();
  });

  it("builds parse argv from raw args", () => {
    const nodeArgv = buildParseArgv({
      programName: "thinkfleet",
      rawArgs: ["node", "thinkfleet", "status"],
    });
    expect(nodeArgv).toEqual(["node", "thinkfleet", "status"]);

    const versionedNodeArgv = buildParseArgv({
      programName: "thinkfleet",
      rawArgs: ["node-22", "thinkfleet", "status"],
    });
    expect(versionedNodeArgv).toEqual(["node-22", "thinkfleet", "status"]);

    const versionedNodeWindowsArgv = buildParseArgv({
      programName: "thinkfleet",
      rawArgs: ["node-22.2.0.exe", "thinkfleet", "status"],
    });
    expect(versionedNodeWindowsArgv).toEqual(["node-22.2.0.exe", "thinkfleet", "status"]);

    const versionedNodePatchlessArgv = buildParseArgv({
      programName: "thinkfleet",
      rawArgs: ["node-22.2", "thinkfleet", "status"],
    });
    expect(versionedNodePatchlessArgv).toEqual(["node-22.2", "thinkfleet", "status"]);

    const versionedNodeWindowsPatchlessArgv = buildParseArgv({
      programName: "thinkfleet",
      rawArgs: ["node-22.2.exe", "thinkfleet", "status"],
    });
    expect(versionedNodeWindowsPatchlessArgv).toEqual(["node-22.2.exe", "thinkfleet", "status"]);

    const versionedNodeWithPathArgv = buildParseArgv({
      programName: "thinkfleet",
      rawArgs: ["/usr/bin/node-22.2.0", "thinkfleet", "status"],
    });
    expect(versionedNodeWithPathArgv).toEqual(["/usr/bin/node-22.2.0", "thinkfleet", "status"]);

    const nodejsArgv = buildParseArgv({
      programName: "thinkfleet",
      rawArgs: ["nodejs", "thinkfleet", "status"],
    });
    expect(nodejsArgv).toEqual(["nodejs", "thinkfleet", "status"]);

    const nonVersionedNodeArgv = buildParseArgv({
      programName: "thinkfleet",
      rawArgs: ["node-dev", "thinkfleet", "status"],
    });
    expect(nonVersionedNodeArgv).toEqual([
      "node",
      "thinkfleet",
      "node-dev",
      "thinkfleet",
      "status",
    ]);

    const directArgv = buildParseArgv({
      programName: "thinkfleet",
      rawArgs: ["thinkfleet", "status"],
    });
    expect(directArgv).toEqual(["node", "thinkfleet", "status"]);

    const bunArgv = buildParseArgv({
      programName: "thinkfleet",
      rawArgs: ["bun", "src/entry.ts", "status"],
    });
    expect(bunArgv).toEqual(["bun", "src/entry.ts", "status"]);
  });

  it("builds parse argv from fallback args", () => {
    const fallbackArgv = buildParseArgv({
      programName: "thinkfleet",
      fallbackArgv: ["status"],
    });
    expect(fallbackArgv).toEqual(["node", "thinkfleet", "status"]);
  });

  it("decides when to migrate state", () => {
    expect(shouldMigrateState(["node", "thinkfleet", "status"])).toBe(false);
    expect(shouldMigrateState(["node", "thinkfleet", "health"])).toBe(false);
    expect(shouldMigrateState(["node", "thinkfleet", "sessions"])).toBe(false);
    expect(shouldMigrateState(["node", "thinkfleet", "memory", "status"])).toBe(false);
    expect(shouldMigrateState(["node", "thinkfleet", "agent", "--message", "hi"])).toBe(false);
    expect(shouldMigrateState(["node", "thinkfleet", "agents", "list"])).toBe(true);
    expect(shouldMigrateState(["node", "thinkfleet", "message", "send"])).toBe(true);
  });

  it("reuses command path for migrate state decisions", () => {
    expect(shouldMigrateStateFromPath(["status"])).toBe(false);
    expect(shouldMigrateStateFromPath(["agents", "list"])).toBe(true);
  });
});
