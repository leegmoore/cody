/**
 * Progress reporting for Ollama model pulls
 *
 * Ported from codex-rs/ollama/src/pull.rs
 */

import type { PullEvent } from "./parser.js";

/**
 * A simple observer for pull progress events. Implementations decide how to
 * render progress (CLI, TUI, logs, ...).
 */
export interface PullProgressReporter {
  onEvent(event: PullEvent): void;
}

/**
 * A minimal CLI reporter that writes inline progress to stderr.
 *
 * This reporter tracks download progress across multiple layers/digests,
 * displaying aggregate progress with download speed calculation.
 */
export class CliProgressReporter implements PullProgressReporter {
  private printedHeader: boolean = false;
  private lastLineLen: number = 0;
  private lastCompletedSum: number = 0;
  private lastInstant: number = Date.now();
  private totalsByDigest: Map<string, { total: number; completed: number }> =
    new Map();

  onEvent(event: PullEvent): void {
    switch (event.type) {
      case "status":
        this.handleStatus(event.status);
        break;

      case "chunk_progress":
        this.handleChunkProgress(event.digest, event.total, event.completed);
        break;

      case "error":
        // Error will be handled by the caller, so we don't print it here
        // to avoid duplicate error messages
        break;

      case "success":
        process.stderr.write("\n");
        break;
    }
  }

  private handleStatus(status: string): void {
    // Avoid noisy manifest messages; otherwise show status inline
    if (status.toLowerCase() === "pulling manifest") {
      return;
    }

    const pad = Math.max(0, this.lastLineLen - status.length);
    const line = `\r${status}${" ".repeat(pad)}`;
    this.lastLineLen = status.length;
    process.stderr.write(line);
  }

  private handleChunkProgress(
    digest: string,
    total: number | undefined,
    completed: number | undefined,
  ): void {
    // Update totals for this digest
    const entry = this.totalsByDigest.get(digest) ?? { total: 0, completed: 0 };

    if (total !== undefined) {
      entry.total = total;
    }
    if (completed !== undefined) {
      entry.completed = completed;
    }

    this.totalsByDigest.set(digest, entry);

    // Calculate aggregate progress across all digests
    let sumTotal = 0;
    let sumCompleted = 0;
    for (const { total: t, completed: c } of this.totalsByDigest.values()) {
      sumTotal += t;
      sumCompleted += c;
    }

    if (sumTotal > 0) {
      // Print header with total size on first progress update
      if (!this.printedHeader) {
        const gb = sumTotal / (1024 * 1024 * 1024);
        const header = `Downloading model: total ${gb.toFixed(2)} GB\n`;
        process.stderr.write("\r\x1b[2K"); // Clear line
        process.stderr.write(header);
        this.printedHeader = true;
      }

      // Calculate download speed
      const now = Date.now();
      const dt = Math.max((now - this.lastInstant) / 1000, 0.001); // seconds
      const dbytes = sumCompleted - this.lastCompletedSum;
      const speedMbS = dbytes / (1024 * 1024) / dt;

      this.lastCompletedSum = sumCompleted;
      this.lastInstant = now;

      // Format progress line
      const doneGb = sumCompleted / (1024 * 1024 * 1024);
      const totalGb = sumTotal / (1024 * 1024 * 1024);
      const pct = (sumCompleted * 100) / sumTotal;

      const text = `${doneGb.toFixed(2)}/${totalGb.toFixed(2)} GB (${pct.toFixed(1)}%) ${speedMbS.toFixed(1)} MB/s`;
      const pad = Math.max(0, this.lastLineLen - text.length);
      const line = `\r${text}${" ".repeat(pad)}`;

      this.lastLineLen = text.length;
      process.stderr.write(line);
    }
  }
}

/**
 * For now the TUI reporter delegates to the CLI reporter. This keeps UI and
 * CLI behavior aligned until a dedicated TUI integration is implemented.
 */
export class TuiProgressReporter implements PullProgressReporter {
  private inner: CliProgressReporter = new CliProgressReporter();

  onEvent(event: PullEvent): void {
    this.inner.onEvent(event);
  }
}
