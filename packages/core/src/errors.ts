export class LaunchProofError extends Error {
  readonly code: string;
  readonly exitCode: number;

  constructor(message: string, code = 'LAUNCHPROOF_ERROR', exitCode = 3) {
    super(message);
    this.name = 'LaunchProofError';
    this.code = code;
    this.exitCode = exitCode;
  }
}

export class ConfigError extends LaunchProofError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR', 2);
    this.name = 'ConfigError';
  }
}

export class UsageError extends LaunchProofError {
  constructor(message: string) {
    super(message, 'USAGE_ERROR', 2);
    this.name = 'UsageError';
  }
}

export class ScopeError extends LaunchProofError {
  constructor(message: string) {
    super(message, 'SCOPE_ERROR', 2);
    this.name = 'ScopeError';
  }
}

export class NetworkError extends LaunchProofError {
  constructor(message: string) {
    super(message, 'NETWORK_ERROR', 3);
    this.name = 'NetworkError';
  }
}

export function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}
