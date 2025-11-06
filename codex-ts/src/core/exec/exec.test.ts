/**
 * Tests for core execution engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  processExecToolCall,
  executeExecEnv,
  isLikelySandboxDenied,
  type ExecParams,
  type ExecToolCallOutput,
  SandboxTimeoutError,
  SandboxDeniedError,
  EXEC_TIMEOUT_EXIT_CODE,
} from './index.js';
import { SandboxType, SandboxManager } from '../sandboxing/index.js';
import type { SandboxPolicy } from '../../protocol/protocol.js';
import { tmpdir } from 'os';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

describe('Core Execution Engine', () => {
  const testDir = join(tmpdir(), 'codex-exec-test');

  beforeEach(() => {
    // Create test directory
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {}
    mkdirSync(testDir, { recursive: true });
  });

  describe('isLikelySandboxDenied', () => {
    it('should return false for exit code 0', () => {
      const output: ExecToolCallOutput = {
        exitCode: 0,
        stdout: { text: 'success' },
        stderr: { text: '' },
        aggregatedOutput: { text: 'success' },
        durationMs: 100,
        timedOut: false,
      };

      expect(isLikelySandboxDenied(SandboxType.MacosSeatbelt, output)).toBe(false);
    });

    it('should return false for no sandbox', () => {
      const output: ExecToolCallOutput = {
        exitCode: 1,
        stdout: { text: '' },
        stderr: { text: 'error' },
        aggregatedOutput: { text: 'error' },
        durationMs: 100,
        timedOut: false,
      };

      expect(isLikelySandboxDenied(SandboxType.None, output)).toBe(false);
    });

    it('should detect permission denied in stderr', () => {
      const output: ExecToolCallOutput = {
        exitCode: 1,
        stdout: { text: '' },
        stderr: { text: 'Permission denied: cannot write to /etc/test' },
        aggregatedOutput: { text: 'Permission denied: cannot write to /etc/test' },
        durationMs: 100,
        timedOut: false,
      };

      expect(isLikelySandboxDenied(SandboxType.LinuxSeccomp, output)).toBe(true);
    });

    it('should detect operation not permitted', () => {
      const output: ExecToolCallOutput = {
        exitCode: 1,
        stdout: { text: '' },
        stderr: { text: 'operation not permitted' },
        aggregatedOutput: { text: 'operation not permitted' },
        durationMs: 100,
        timedOut: false,
      };

      expect(isLikelySandboxDenied(SandboxType.MacosSeatbelt, output)).toBe(true);
    });

    it('should detect read-only file system', () => {
      const output: ExecToolCallOutput = {
        exitCode: 1,
        stdout: { text: '' },
        stderr: { text: 'cannot create file: Read-only file system' },
        aggregatedOutput: { text: 'cannot create file: Read-only file system' },
        durationMs: 100,
        timedOut: false,
      };

      expect(isLikelySandboxDenied(SandboxType.LinuxSeccomp, output)).toBe(true);
    });

    it('should not detect for common shell exit codes', () => {
      const output: ExecToolCallOutput = {
        exitCode: 127, // command not found
        stdout: { text: '' },
        stderr: { text: 'command not found: foo' },
        aggregatedOutput: { text: 'command not found: foo' },
        durationMs: 100,
        timedOut: false,
      };

      expect(isLikelySandboxDenied(SandboxType.LinuxSeccomp, output)).toBe(false);
    });

    it('should detect SIGSYS signal for Linux seccomp (exit code 159)', () => {
      const output: ExecToolCallOutput = {
        exitCode: 159, // 128 + 31 (SIGSYS)
        stdout: { text: '' },
        stderr: { text: '' },
        aggregatedOutput: { text: '' },
        durationMs: 100,
        timedOut: false,
      };

      expect(isLikelySandboxDenied(SandboxType.LinuxSeccomp, output)).toBe(true);
    });
  });

  describe('Basic Command Execution', () => {
    const readOnlyPolicy: SandboxPolicy = { mode: 'read-only' };

    it('should execute echo command', async () => {
      const params: ExecParams = {
        command: ['echo', 'hello world'],
        cwd: testDir,
        env: {},
      };

      const result = await processExecToolCall(
        params,
        SandboxType.None,
        readOnlyPolicy,
        testDir,
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout.text.trim()).toBe('hello world');
      expect(result.timedOut).toBe(false);
    });

    it('should capture exit code', async () => {
      const params: ExecParams = {
        command: ['sh', '-c', 'exit 42'],
        cwd: testDir,
        env: {},
      };

      const result = await processExecToolCall(
        params,
        SandboxType.None,
        readOnlyPolicy,
        testDir,
      );

      expect(result.exitCode).toBe(42);
    });

    it('should capture stdout', async () => {
      const params: ExecParams = {
        command: ['sh', '-c', 'echo "line 1"; echo "line 2"'],
        cwd: testDir,
        env: {},
      };

      const result = await processExecToolCall(
        params,
        SandboxType.None,
        readOnlyPolicy,
        testDir,
      );

      expect(result.stdout.text).toContain('line 1');
      expect(result.stdout.text).toContain('line 2');
    });

    it('should capture stderr', async () => {
      const params: ExecParams = {
        command: ['sh', '-c', 'echo "error message" >&2'],
        cwd: testDir,
        env: {},
      };

      const result = await processExecToolCall(
        params,
        SandboxType.None,
        readOnlyPolicy,
        testDir,
      );

      expect(result.stderr.text).toContain('error message');
    });

    it('should capture aggregated output', async () => {
      const params: ExecParams = {
        command: ['sh', '-c', 'echo "stdout"; echo "stderr" >&2'],
        cwd: testDir,
        env: {},
      };

      const result = await processExecToolCall(
        params,
        SandboxType.None,
        readOnlyPolicy,
        testDir,
      );

      expect(result.aggregatedOutput.text).toContain('stdout');
      expect(result.aggregatedOutput.text).toContain('stderr');
    });

    it('should measure duration', async () => {
      const params: ExecParams = {
        command: ['sh', '-c', 'sleep 0.1'],
        cwd: testDir,
        env: {},
      };

      const result = await processExecToolCall(
        params,
        SandboxType.None,
        readOnlyPolicy,
        testDir,
      );

      expect(result.durationMs).toBeGreaterThan(90);
    });
  });

  describe('Environment Variables', () => {
    const readOnlyPolicy: SandboxPolicy = { mode: 'read-only' };

    it('should pass environment variables', async () => {
      const params: ExecParams = {
        command: ['sh', '-c', 'echo $TEST_VAR'],
        cwd: testDir,
        env: { TEST_VAR: 'test_value' },
      };

      const result = await processExecToolCall(
        params,
        SandboxType.None,
        readOnlyPolicy,
        testDir,
      );

      expect(result.stdout.text.trim()).toBe('test_value');
    });

    it('should override environment variables', async () => {
      const params: ExecParams = {
        command: ['sh', '-c', 'echo $CUSTOM_VAR'],
        cwd: testDir,
        env: { CUSTOM_VAR: 'custom_value', PATH: process.env.PATH || '' },
      };

      const result = await processExecToolCall(
        params,
        SandboxType.None,
        readOnlyPolicy,
        testDir,
      );

      expect(result.stdout.text.trim()).toBe('custom_value');
    });
  });

  describe('Working Directory', () => {
    const readOnlyPolicy: SandboxPolicy = { mode: 'read-only' };

    it('should execute in specified directory', async () => {
      const params: ExecParams = {
        command: ['pwd'],
        cwd: testDir,
        env: {},
      };

      const result = await processExecToolCall(
        params,
        SandboxType.None,
        readOnlyPolicy,
        testDir,
      );

      // pwd output should match testDir (normalized)
      expect(result.stdout.text.trim()).toBe(testDir);
    });
  });

  describe('Timeout Handling', () => {
    const readOnlyPolicy: SandboxPolicy = { mode: 'read-only' };

    it('should timeout long-running command', async () => {
      const params: ExecParams = {
        command: ['sleep', '10'],
        cwd: testDir,
        env: {},
        timeoutMs: 100,
      };

      await expect(
        processExecToolCall(params, SandboxType.None, readOnlyPolicy, testDir),
      ).rejects.toThrow(SandboxTimeoutError);
    });

    it('should set timeout exit code', async () => {
      const params: ExecParams = {
        command: ['sleep', '10'],
        cwd: testDir,
        env: {},
        timeoutMs: 100,
      };

      try {
        await processExecToolCall(params, SandboxType.None, readOnlyPolicy, testDir);
        expect.fail('Should have thrown timeout error');
      } catch (error) {
        if (error instanceof SandboxTimeoutError) {
          expect(error.output.exitCode).toBe(EXEC_TIMEOUT_EXIT_CODE);
          expect(error.output.timedOut).toBe(true);
        } else {
          throw error;
        }
      }
    });

    it('should not timeout fast command', async () => {
      const params: ExecParams = {
        command: ['echo', 'quick'],
        cwd: testDir,
        env: {},
        timeoutMs: 5000,
      };

      const result = await processExecToolCall(
        params,
        SandboxType.None,
        readOnlyPolicy,
        testDir,
      );

      expect(result.timedOut).toBe(false);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Sandbox Integration', () => {
    it('should use SandboxManager to transform command', async () => {
      const params: ExecParams = {
        command: ['ls', '-la'],
        cwd: testDir,
        env: {},
      };

      const policy: SandboxPolicy = { mode: 'read-only' };

      // This should work with no sandbox
      const result = await processExecToolCall(params, SandboxType.None, policy, testDir);

      expect(result).toBeDefined();
      expect(result.exitCode).toBeDefined();
    });

    it('should add network disabled env var for read-only policy', async () => {
      const params: ExecParams = {
        command: ['sh', '-c', 'echo $CODEX_SANDBOX_NETWORK_DISABLED'],
        cwd: testDir,
        env: {},
      };

      const policy: SandboxPolicy = { mode: 'read-only' };

      const result = await processExecToolCall(params, SandboxType.None, policy, testDir);

      expect(result.stdout.text.trim()).toBe('1');
    });

    it('should execute transformed ExecEnv', async () => {
      const policy: SandboxPolicy = { mode: 'read-only' };
      const manager = new SandboxManager();

      const execEnv = manager.transform(
        {
          program: 'echo',
          args: ['test'],
          cwd: testDir,
          env: {},
        },
        policy,
        SandboxType.None,
        testDir,
      );

      const result = await executeExecEnv(execEnv, policy);

      expect(result.exitCode).toBe(0);
      expect(result.stdout.text.trim()).toBe('test');
    });
  });

  describe('Error Handling', () => {
    const readOnlyPolicy: SandboxPolicy = { mode: 'read-only' };

    it('should throw for empty command', async () => {
      const params: ExecParams = {
        command: [],
        cwd: testDir,
        env: {},
      };

      await expect(
        processExecToolCall(params, SandboxType.None, readOnlyPolicy, testDir),
      ).rejects.toThrow('command args are empty');
    });

    it('should handle command not found', async () => {
      const params: ExecParams = {
        command: ['nonexistent_command_12345'],
        cwd: testDir,
        env: {},
      };

      await expect(
        processExecToolCall(params, SandboxType.None, readOnlyPolicy, testDir),
      ).rejects.toThrow();
    });
  });
});
