import { execFile, spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const KEYCHAIN_SERVICE = 'launchproof-cli';
const KEYCHAIN_ACCOUNT = 'default';

function configDir(): string {
  return (
    process.env.LAUNCHPROOF_CONFIG_DIR?.trim() || path.join(os.homedir(), '.config', 'launchproof')
  );
}

function credentialPath(): string {
  return path.join(configDir(), 'credentials.json');
}

function useKeychain(): boolean {
  return process.platform === 'darwin' && process.env.LAUNCHPROOF_NO_KEYCHAIN !== '1';
}

function addKeychainToken(token: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Pass the secret on stdin, not argv. Command-line arguments are visible to other local
    // processes; `security` prompts for the password when -w is the final argument.
    const child = spawn(
      'security',
      ['add-generic-password', '-s', KEYCHAIN_SERVICE, '-a', KEYCHAIN_ACCOUNT, '-U', '-w'],
      { stdio: ['pipe', 'ignore', 'pipe'] },
    );
    let stderr = '';
    child.stdin.on('error', () => {
      // A closed stdin is reported by the process exit code.
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Keychain write timed out.'));
    }, 5_000);
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || 'Keychain write failed.'));
    });
    // `security` asks for the password twice when -w is last.
    child.stdin.end(`${token}\n${token}\n`);
  });
}

export async function getStoredToken(): Promise<string | null> {
  const environmentToken = process.env.LAUNCHPROOF_CLI_TOKEN?.trim();
  if (environmentToken) return environmentToken;
  if (useKeychain()) {
    try {
      const { stdout } = await execFileAsync(
        'security',
        ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', KEYCHAIN_ACCOUNT, '-w'],
        { timeout: 5_000 },
      );
      const token = stdout.trim();
      if (token) return token;
    } catch {
      // Fall through to the protected file.
    }
  }
  try {
    const raw = await fs.readFile(credentialPath(), 'utf8');
    const parsed = JSON.parse(raw) as { token?: unknown };
    return typeof parsed.token === 'string' && parsed.token.length > 0 ? parsed.token : null;
  } catch {
    return null;
  }
}

export async function storeToken(token: string): Promise<'keychain' | 'file'> {
  if (useKeychain()) {
    try {
      await addKeychainToken(token);
      return 'keychain';
    } catch {
      // Fall back to a mode-0600 file.
    }
  }
  const directory = configDir();
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const file = credentialPath();
  await fs.writeFile(file, `${JSON.stringify({ token }, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  await fs.chmod(file, 0o600);
  return 'file';
}

export async function deleteStoredToken(): Promise<void> {
  if (useKeychain()) {
    try {
      await execFileAsync(
        'security',
        ['delete-generic-password', '-s', KEYCHAIN_SERVICE, '-a', KEYCHAIN_ACCOUNT],
        { timeout: 5_000 },
      );
    } catch {
      // No Keychain entry.
    }
  }
  try {
    await fs.unlink(credentialPath());
  } catch {
    // No file entry.
  }
}
