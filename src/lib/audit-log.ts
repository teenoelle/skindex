import { supabaseAdmin } from "./supabase-admin";

export async function writeAuditLog(
  adminClerkId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  detail: Record<string, unknown>
): Promise<void> {
  try {
    await supabaseAdmin.from("admin_audit_log").insert({
      admin_clerk_id: adminClerkId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      detail,
    });
  } catch {
    // audit log failure is non-fatal
  }
}
