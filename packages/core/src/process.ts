import { spawn } from 'node:child_process';

export interface CommandResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  spawnError: string | null;
}

export interface RunCommandOptions {
  cwd?: string;
  timeoutMs?: number;
  maxBufferBytes?: number;
  env?: NodeJS.ProcessEnv;
}

/**
 * Runs a command without a shell. Output is capped and the process is killed on timeout so a
 * misbehaving tool cannot hang a scan or exhaust memory.
 */
export function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions = {},
): Promise<CommandResult> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxBytes = options.maxBufferBytes ?? 2_000_000;

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;
    let spawnError: string | null = null;
    let timer: NodeJS.Timeout | null = null;

    const finish = (code: number | null): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      resolve({ code, stdout, stderr, timedOut, spawnError });
    };

    let child;
    try {
      child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env ?? process.env,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      resolve({
        code: null,
        stdout: '',
        stderr: '',
        timedOut: false,
        spawnError: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      if (stdout.length < maxBytes) {
        stdout += chunk.slice(0, maxBytes - stdout.length);
      }
    });
    child.stderr?.on('data', (chunk: string) => {
      if (stderr.length < maxBytes) {
        stderr += chunk.slice(0, maxBytes - stderr.length);
      }
    });
    child.on('error', (error) => {
      spawnError = error.message;
      finish(null);
    });
    child.on('close', (code) => {
      finish(code);
    });

    timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
      finish(null);
    }, timeoutMs);
    timer.unref?.();
  });
}
