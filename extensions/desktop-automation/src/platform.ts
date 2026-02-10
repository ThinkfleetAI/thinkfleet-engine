/**
 * Platform detection utilities for desktop automation.
 */

/**
 * Check if running on a desktop platform (Windows or macOS).
 */
export function isDesktopPlatform(): boolean {
  return process.platform === "win32" || process.platform === "darwin";
}

/**
 * Get the current platform name.
 */
export function getPlatformName(): "windows" | "macos" | "linux" | "unknown" {
  switch (process.platform) {
    case "win32":
      return "windows";
    case "darwin":
      return "macos";
    case "linux":
      return "linux";
    default:
      return "unknown";
  }
}

/**
 * Check if running in a container/sandboxed environment.
 */
export function isContainerEnvironment(): boolean {
  // Check for common container indicators
  if (process.env.KUBERNETES_SERVICE_HOST) return true;
  if (process.env.DOCKER_CONTAINER) return true;

  // Check for cgroup indicators (Linux containers)
  if (process.platform === "linux") {
    try {
      const fs = require("node:fs");
      const cgroup = fs.readFileSync("/proc/1/cgroup", "utf8");
      if (cgroup.includes("docker") || cgroup.includes("kubepods")) {
        return true;
      }
    } catch {
      // Ignore errors
    }
  }

  return false;
}
