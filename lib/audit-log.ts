/**
 * Audit Logging for Admin Actions
 * 
 * Логирует все важные действия администраторов для безопасности и отладки
 */

import { prisma } from "@/lib/prisma";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type AuditAction = 
  // Auth
  | "auth.login_success"
  | "auth.login_failed"
  | "auth.logout"
  // Quiz management
  | "quiz.create"
  | "quiz.update"
  | "quiz.delete"
  // User management
  | "user.reset_energy"
  | "user.ban"
  | "user.unban"
  | "user.modify_xp"
  // Tournament management
  | "tournament.create"
  | "tournament.update"
  | "tournament.finalize"
  | "tournament.cancel"
  // Shop management
  | "shop.create_item"
  | "shop.update_item"
  | "shop.delete_item"
  // System
  | "system.cron_manual"
  | "system.config_change";

export type AuditLogEntry = {
  action: AuditAction;
  adminId?: number;
  adminTelegramId?: string;
  targetType?: "user" | "quiz" | "tournament" | "item" | "system";
  targetId?: string | number;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// IN-MEMORY BUFFER (for high-volume logging)
// ═══════════════════════════════════════════════════════════════════════════

const LOG_BUFFER: AuditLogEntry[] = [];
const BUFFER_SIZE = 10;
const FLUSH_INTERVAL_MS = 30_000; // 30 seconds

let flushTimer: NodeJS.Timeout | null = null;

// ═══════════════════════════════════════════════════════════════════════════
// CORE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Log an admin action
 * 
 * @example
 * await auditLog({
 *   action: "quiz.delete",
 *   adminId: 1,
 *   adminTelegramId: "123456",
 *   targetType: "quiz",
 *   targetId: 42,
 *   details: { quizTitle: "Famous Cases" }
 * });
 */
export async function auditLog(entry: AuditLogEntry): Promise<void> {
  const timestamp = new Date().toISOString();
  
  // Always log to console for immediate visibility
  console.log(
    `[AUDIT] ${timestamp} | ${entry.action} | admin:${entry.adminTelegramId || "unknown"} | ` +
    `${entry.targetType || ""}:${entry.targetId || ""} | ` +
    `${JSON.stringify(entry.details || {})}`
  );
  
  // Add to buffer for batch DB write
  LOG_BUFFER.push(entry);
  
  // Flush if buffer is full
  if (LOG_BUFFER.length >= BUFFER_SIZE) {
    await flushAuditLogs();
  } else if (!flushTimer) {
    // Schedule flush
    flushTimer = setTimeout(flushAuditLogs, FLUSH_INTERVAL_MS);
  }
}

/**
 * Synchronous logging for critical actions (writes immediately)
 */
export async function auditLogSync(entry: AuditLogEntry): Promise<void> {
  const timestamp = new Date().toISOString();
  
  console.log(
    `[AUDIT:SYNC] ${timestamp} | ${entry.action} | admin:${entry.adminTelegramId || "unknown"} | ` +
    `${entry.targetType || ""}:${entry.targetId || ""}`
  );
  
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        adminId: entry.adminId || null,
        adminTelegramId: entry.adminTelegramId || null,
        targetType: entry.targetType || null,
        targetId: entry.targetId?.toString() || null,
        details: entry.details || {},
        ipAddress: entry.ipAddress || null,
        userAgent: entry.userAgent || null,
      },
    });
  } catch (error) {
    console.error("[AUDIT] Failed to write sync log:", error);
  }
}

/**
 * Flush buffered logs to database
 */
async function flushAuditLogs(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  
  if (LOG_BUFFER.length === 0) return;
  
  const logsToWrite = [...LOG_BUFFER];
  LOG_BUFFER.length = 0;
  
  try {
    await prisma.auditLog.createMany({
      data: logsToWrite.map(entry => ({
        action: entry.action,
        adminId: entry.adminId || null,
        adminTelegramId: entry.adminTelegramId || null,
        targetType: entry.targetType || null,
        targetId: entry.targetId?.toString() || null,
        details: entry.details || {},
        ipAddress: entry.ipAddress || null,
        userAgent: entry.userAgent || null,
      })),
    });
    
    console.log(`[AUDIT] Flushed ${logsToWrite.length} log entries to database`);
  } catch (error) {
    console.error("[AUDIT] Failed to flush logs:", error);
    // Re-add to buffer on failure
    LOG_BUFFER.push(...logsToWrite);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract IP address from request
 */
export function getIpFromRequest(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  
  return realIp || "unknown";
}

/**
 * Extract user agent from request
 */
export function getUserAgentFromRequest(req: Request): string {
  return req.headers.get("user-agent") || "unknown";
}

/**
 * Create audit log entry with request context
 */
export function createAuditEntry(
  req: Request,
  admin: { id: number; telegramId: string },
  action: AuditAction,
  target?: { type: AuditLogEntry["targetType"]; id: string | number },
  details?: Record<string, unknown>
): AuditLogEntry {
  return {
    action,
    adminId: admin.id,
    adminTelegramId: admin.telegramId,
    targetType: target?.type,
    targetId: target?.id,
    details,
    ipAddress: getIpFromRequest(req),
    userAgent: getUserAgentFromRequest(req),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// QUERY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get recent audit logs for admin dashboard
 */
export async function getRecentAuditLogs(limit: number = 50): Promise<{
  action: string;
  adminTelegramId: string;
  targetType: string | null;
  targetId: string | null;
  details: unknown;
  createdAt: Date;
}[]> {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      action: true,
      adminTelegramId: true,
      targetType: true,
      targetId: true,
      details: true,
      createdAt: true,
    },
  });
}

/**
 * Get audit logs for a specific admin
 */
export async function getAdminAuditLogs(
  adminTelegramId: string,
  limit: number = 50
): Promise<typeof prisma.auditLog.findMany> {
  return prisma.auditLog.findMany({
    where: { adminTelegramId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Get audit logs for a specific target
 */
export async function getTargetAuditLogs(
  targetType: string,
  targetId: string,
  limit: number = 50
): Promise<typeof prisma.auditLog.findMany> {
  return prisma.auditLog.findMany({
    where: { targetType, targetId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

