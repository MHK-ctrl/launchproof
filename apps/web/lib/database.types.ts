export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ProfileRow = {
  id: string;
  github_user_id: number | null;
  github_username: string | null;
  avatar_url: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
};

export type RepositoryRow = {
  id: string;
  user_id: string;
  github_repository_id: number;
  owner: string;
  name: string;
  full_name: string;
  html_url: string;
  default_branch: string | null;
  visibility: 'public' | 'private' | 'internal';
  connection_status: 'active' | 'disconnected';
  connected_at: string;
  updated_at: string;
};

export type ScanRow = {
  id: string;
  user_id: string;
  repository_id: string;
  client_scan_id: string;
  scan_status: 'completed' | 'partial' | 'failed';
  security_gate: 'passed' | 'failed' | 'not-verified';
  scanner_version: string;
  commit_sha: string | null;
  branch: string | null;
  started_at: string | null;
  completed_at: string | null;
  uploaded_at: string;
  total_checks: number;
  pass_count: number;
  fail_count: number;
  warning_count: number;
  skipped_count: number;
  not_verified_count: number;
  error_count: number;
  total_findings: number;
  severity_counts: Json;
  summary: Json;
  checks: Json;
  limitations: Json;
  report_format_version: number;
  created_at: string;
};

export type FindingRow = {
  id: string;
  user_id: string;
  scan_id: string;
  finding_key: string;
  rule_id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  category: string | null;
  remediation: string | null;
  relative_file_path: string | null;
  line_number: number | null;
  created_at: string;
};

export type CliAuthRequestRow = {
  id: string;
  user_id: string;
  state: string;
  code_hash: string;
  code_challenge: string;
  redirect_port: number;
  expires_at: string;
  approved_at: string | null;
  consumed_at: string | null;
  created_at: string;
};

export type CliTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  label: string | null;
  created_at: string;
  last_used_at: string | null;
  expires_at: string;
  revoked_at: string | null;
};

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<
        ProfileRow,
        {
          id: string;
          github_user_id?: number | null;
          github_username?: string | null;
          avatar_url?: string | null;
          email?: string | null;
        },
        {
          github_user_id?: number | null;
          github_username?: string | null;
          avatar_url?: string | null;
          email?: string | null;
        }
      >;
      repositories: Table<
        RepositoryRow,
        {
          id?: string;
          user_id: string;
          github_repository_id: number;
          owner: string;
          name: string;
          full_name: string;
          html_url: string;
          default_branch?: string | null;
          visibility: 'public' | 'private' | 'internal';
          connection_status?: 'active' | 'disconnected';
        },
        {
          owner?: string;
          name?: string;
          full_name?: string;
          html_url?: string;
          default_branch?: string | null;
          visibility?: 'public' | 'private' | 'internal';
          connection_status?: 'active' | 'disconnected';
        }
      >;
      scans: Table<
        ScanRow,
        {
          id?: string;
          user_id: string;
          repository_id: string;
          client_scan_id: string;
          scan_status?: 'completed' | 'partial' | 'failed';
          security_gate: 'passed' | 'failed' | 'not-verified';
          scanner_version: string;
          commit_sha?: string | null;
          branch?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          total_checks?: number;
          pass_count?: number;
          fail_count?: number;
          warning_count?: number;
          skipped_count?: number;
          not_verified_count?: number;
          error_count?: number;
          total_findings?: number;
          severity_counts?: Json;
          summary?: Json;
          checks?: Json;
          limitations?: Json;
          report_format_version?: number;
        },
        {
          scan_status?: 'completed' | 'partial' | 'failed';
          security_gate?: 'passed' | 'failed' | 'not-verified';
          commit_sha?: string | null;
          branch?: string | null;
        }
      >;
      findings: Table<
        FindingRow,
        {
          id?: string;
          user_id: string;
          scan_id: string;
          finding_key: string;
          rule_id: string;
          severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
          title: string;
          description: string;
          category?: string | null;
          remediation?: string | null;
          relative_file_path?: string | null;
          line_number?: number | null;
        },
        {
          title?: string;
          description?: string;
          remediation?: string | null;
        }
      >;
      cli_auth_requests: Table<
        CliAuthRequestRow,
        {
          id?: string;
          user_id: string;
          state: string;
          code_hash: string;
          code_challenge: string;
          redirect_port: number;
          expires_at: string;
          approved_at?: string | null;
        },
        { consumed_at?: string | null; approved_at?: string | null }
      >;
      cli_tokens: Table<
        CliTokenRow,
        {
          id?: string;
          user_id: string;
          token_hash: string;
          label?: string | null;
          expires_at: string;
        },
        { last_used_at?: string | null; revoked_at?: string | null }
      >;
    };
    Views: {
      repository_scan_stats: {
        Row: {
          repository_id: string;
          user_id: string;
          scan_count: number;
          last_scan_at: string | null;
          last_successful_scan_at: string | null;
          latest_gate: 'passed' | 'failed' | 'not-verified' | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      consume_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number };
        Returns: Array<{ allowed: boolean; remaining: number; retry_after: number }>;
      };
      cleanup_cli_tokens: {
        Args: { p_user_id: string };
        Returns: number;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
