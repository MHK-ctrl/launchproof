import type { SupabaseClient } from '@supabase/supabase-js';

import { cloudScanSchema, normalizeCloudScan } from '@/lib/cloud-scan';
import type { Database } from '@/lib/database.types';

export interface StoreScanResult {
  ok: true;
  scanId: string;
  findingsStored: number;
}

export interface StoreScanError {
  ok: false;
  status: number;
  code: string;
  message: string;
}

export async function storeScanForUser(
  db: SupabaseClient<Database>,
  userId: string,
  payload: unknown,
): Promise<StoreScanResult | StoreScanError> {
  const parsed = cloudScanSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      code: 'invalid_scan',
      message: 'Scan payload did not pass validation.',
    };
  }

  const { data: repository } = await db
    .from('repositories')
    .select('id,user_id,connection_status')
    .eq('id', parsed.data.repositoryId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!repository || repository.connection_status !== 'active') {
    return {
      ok: false,
      status: 404,
      code: 'repository_not_found',
      message: 'Connected repository not found.',
    };
  }

  const normalized = normalizeCloudScan(parsed.data);
  const { data: scan, error } = await db
    .from('scans')
    .upsert(
      {
        user_id: userId,
        repository_id: repository.id,
        ...normalized.scan,
        report_format_version: 1,
      },
      { onConflict: 'user_id,client_scan_id' },
    )
    .select('id')
    .single();
  if (error || !scan) {
    return {
      ok: false,
      status: 500,
      code: 'scan_store_failed',
      message: 'Scan could not be stored.',
    };
  }

  await db.from('findings').delete().eq('scan_id', scan.id).eq('user_id', userId);
  if (normalized.findings.length > 0) {
    const { error: findingError } = await db
      .from('findings')
      .insert(
        normalized.findings.map((finding) => ({ user_id: userId, scan_id: scan.id, ...finding })),
      );
    if (findingError) {
      await db.from('scans').delete().eq('id', scan.id).eq('user_id', userId);
      return {
        ok: false,
        status: 500,
        code: 'scan_store_failed',
        message: 'Scan findings could not be stored.',
      };
    }
  }

  return { ok: true, scanId: scan.id, findingsStored: normalized.findings.length };
}
