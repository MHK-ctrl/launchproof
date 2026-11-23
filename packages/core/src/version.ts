export const VERSION = '0.1.0';
export const REPORT_SCHEMA_VERSION = 1;
export const DEFAULT_CONFIG_FILENAMES = [
  'launchproof.config.json',
  'launchproof.config.yaml',
  'launchproof.config.yml',
] as const;

export const PROJECT_URL = 'https://github.com/MHK-ctrl/launchproof';
export const TOOL_USER_AGENT = `LaunchProof/${VERSION} (+${PROJECT_URL})`;
