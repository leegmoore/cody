/**
 * Feature flags and metadata module.
 * Ported from codex-rs/core/src/features.rs
 *
 * NOTE: This is a STUB implementation for Phase 5.1.
 * All features are disabled by default. Full feature flag system will be implemented later.
 */

/**
 * High-level lifecycle stage for a feature.
 */
export enum Stage {
  Experimental = "experimental",
  Beta = "beta",
  Stable = "stable",
  Deprecated = "deprecated",
  Removed = "removed",
}

/**
 * Unique features toggled via configuration.
 */
export enum Feature {
  /** Use the single unified PTY-backed exec tool. */
  UnifiedExec = "unified_exec",
  /** Use the streamable exec-command/write-stdin tool pair. */
  StreamableShell = "streamable_shell",
  /** Enable experimental RMCP features such as OAuth login. */
  RmcpClient = "rmcp_client",
  /** Include the freeform apply_patch tool. */
  ApplyPatchFreeform = "apply_patch_freeform",
  /** Include the view_image tool. */
  ViewImageTool = "view_image_tool",
  /** Allow the model to request web searches. */
  WebSearchRequest = "web_search_request",
  /** Enable the model-based risk assessments for sandboxed commands. */
  SandboxCommandAssessment = "sandbox_command_assessment",
  /** Create a ghost commit at each turn. */
  GhostCommit = "ghost_commit",
  /** Enable Windows sandbox (restricted token) on Windows. */
  WindowsSandbox = "windows_sandbox",
}

/**
 * Holds the effective set of enabled features.
 *
 * STUB: All features are disabled for MVP.
 */
export class Features {
  private enabledFeatures: Set<Feature>;

  constructor() {
    // Stub: no features enabled by default
    this.enabledFeatures = new Set();
  }

  /**
   * Creates Features instance with default settings.
   *
   * STUB: Returns empty set (all features disabled).
   */
  static withDefaults(): Features {
    return new Features();
  }

  /**
   * Check if a feature is enabled.
   *
   * STUB: Always returns false.
   */
  enabled(feature: Feature): boolean {
    return this.enabledFeatures.has(feature);
  }

  /**
   * Enable a feature.
   */
  enable(feature: Feature): void {
    this.enabledFeatures.add(feature);
  }

  /**
   * Disable a feature.
   */
  disable(feature: Feature): void {
    this.enabledFeatures.delete(feature);
  }

  /**
   * Get all enabled features.
   */
  getEnabled(): Feature[] {
    return Array.from(this.enabledFeatures);
  }
}
