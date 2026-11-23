import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export interface DemoServer {
  url: string;
  stop: () => Promise<void>;
}

/** Starts a demo server on an ephemeral loopback port and waits for its readiness line. */
export async function startDemo(name: 'vulnerable-demo' | 'secure-demo'): Promise<DemoServer> {
  const child: ChildProcess = spawn(
    process.execPath,
    [path.join(ROOT, 'examples', name, 'server.mjs')],
    {
      cwd: path.join(ROOT, 'examples', name),
      env: { ...process.env, PORT: '0', HOST: '127.0.0.1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let stderr = '';
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString('utf8');
  });

  const url = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Demo server did not start in time. ${stderr}`));
    }, 10_000);
    let buffer = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const match = /LAUNCHPROOF_DEMO_URL=(http:\/\/[^\s]+)/.exec(buffer);
      if (match?.[1]) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Demo server exited early with code ${code}. ${stderr}`));
    });
  });

  return {
    url,
    stop: async () => {
      if (child.exitCode === null) {
        child.kill('SIGTERM');
        await Promise.race([
          once(child, 'exit'),
          new Promise((resolve) => setTimeout(resolve, 2000)),
        ]);
        if (child.exitCode === null) child.kill('SIGKILL');
      }
    },
  };
}

export const PROJECT_ROOT = ROOT;
