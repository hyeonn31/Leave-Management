import { and, desc, eq, sql, gte, lte, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  employees,
  leaveBalances,
  leaveRequests,
  leaveAdjustments,
  notifications,
  teams,
  type Employee,
  type InsertEmployee,
  type LeaveBalance,
  type InsertLeaveBalance,
  type LeaveRequest,
  type InsertLeaveRequest,
  type InsertLeaveAdjustment,
  type InsertNotification,
  type Notification,
  type Team,
  type InsertTeam,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── User helpers ──────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<{ isNew: boolean }> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return { isNew: false };

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value !== undefined) {
      values[field] = value ?? null;
      updateSet[field] = value ?? null;
    }
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  // Check if user already exists before upsert
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.openId, user.openId)).limit(1);
  const isNew = existing.length === 0;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  return { isNew };
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(users.name);
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function updateUserRole(userId: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

// ─── Employee helpers ──────────────────────────────────────────────────────────

export async function getEmployeeByUserId(userId: number): Promise<Employee | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(employees).where(eq(employees.userId, userId)).limit(1);
  return result[0];
}

export async function upsertEmployee(data: InsertEmployee): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(employees).values(data).onDuplicateKeyUpdate({
    set: {
      employeeNumber: data.employeeNumber,
      department: data.department,
      position: data.position,
      entryDate: data.entryDate,
      status: data.status,
    },
  });
}

export async function getAllEmployeesWithUsers() {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      user: users,
      employee: employees,
    })
    .from(users)
    .leftJoin(employees, eq(users.id, employees.userId))
    .orderBy(users.name);
  return result;
}

export async function updateEmployee(userId: number, data: Partial<InsertEmployee>) {
  const db = await getDb();
  if (!db) return;
  await db.update(employees).set(data).where(eq(employees.userId, userId));
}

// ─── Leave Balance helpers ─────────────────────────────────────────────────────

export async function getLeaveBalance(userId: number, fiscalYear: number): Promise<LeaveBalance | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(leaveBalances)
    .where(and(eq(leaveBalances.userId, userId), eq(leaveBalances.fiscalYear, fiscalYear)))
    .limit(1);
  return result[0];
}

export async function upsertLeaveBalance(data: InsertLeaveBalance): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(leaveBalances).values(data).onDuplicateKeyUpdate({
    set: {
      totalGranted: data.totalGranted,
      used: data.used,
      remaining: data.remaining,
    },
  });
}

export async function getAllLeaveBalancesForYear(fiscalYear: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ balance: leaveBalances, user: users, employee: employees })
    .from(leaveBalances)
    .innerJoin(users, eq(leaveBalances.userId, users.id))
    .leftJoin(employees, eq(leaveBalances.userId, employees.userId))
    .where(eq(leaveBalances.fiscalYear, fiscalYear))
    .orderBy(users.name);
}

export async function updateLeaveBalanceUsed(userId: number, fiscalYear: number, usedDelta: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(leaveBalances)
    .set({
      used: sql`used + ${usedDelta}`,
      remaining: sql`remaining - ${usedDelta}`,
    })
    .where(and(eq(leaveBalances.userId, userId), eq(leaveBalances.fiscalYear, fiscalYear)));
}

// ─── Leave Request helpers ─────────────────────────────────────────────────────

export async function createLeaveRequest(data: InsertLeaveRequest): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(leaveRequests).values(data);
  return (result[0] as any).insertId as number;
}

export async function getLeaveRequestById(id: number): Promise<LeaveRequest | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id)).limit(1);
  return result[0];
}

export async function getLeaveRequestsByUser(userId: number, fiscalYear?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(leaveRequests.userId, userId)];
  if (fiscalYear) {
    const start = `${fiscalYear}-01-01`;
    const end = `${fiscalYear}-12-31`;
    conditions.push(gte(leaveRequests.startDate, start as any));
    conditions.push(lte(leaveRequests.startDate, end as any));
  }
  return db
    .select()
    .from(leaveRequests)
    .where(and(...conditions))
    .orderBy(desc(leaveRequests.createdAt));
}

export async function getAllLeaveRequests(status?: "pending" | "approved" | "rejected") {
  const db = await getDb();
  if (!db) return [];
  const query = db
    .select({ request: leaveRequests, user: users, employee: employees })
    .from(leaveRequests)
    .innerJoin(users, eq(leaveRequests.userId, users.id))
    .leftJoin(employees, eq(leaveRequests.userId, employees.userId))
    .orderBy(desc(leaveRequests.createdAt));

  if (status) {
    return query.where(eq(leaveRequests.status, status));
  }
  return query;
}

export async function updateLeaveRequestStatus(
  id: number,
  status: "approved" | "rejected",
  approverId: number,
  rejectionReason?: string
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(leaveRequests)
    .set({
      status,
      approverId,
      rejectionReason: rejectionReason ?? null,
      approvedAt: new Date(),
    })
    .where(eq(leaveRequests.id, id));
}

export async function updateTeamApprovalStatus(
  id: number,
  teamApprovalStatus: "pending" | "approved" | "rejected",
  teamApproverId: number
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(leaveRequests)
    .set({
      teamApprovalStatus,
      teamApproverId,
      teamApprovedAt: new Date(),
    })
    .where(eq(leaveRequests.id, id));
}
export async function cancelLeaveRequest(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(leaveRequests).where(eq(leaveRequests.id, id));
}

// ─── Leave Adjustment helpers ──────────────────────────────────────────────────

export async function createLeaveAdjustment(data: InsertLeaveAdjustment) {
  const db = await getDb();
  if (!db) return;
  await db.insert(leaveAdjustments).values(data);
}

export async function getLeaveAdjustmentsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(leaveAdjustments)
    .where(eq(leaveAdjustments.userId, userId))
    .orderBy(desc(leaveAdjustments.createdAt));
}

// ─── Notification helpers ──────────────────────────────────────────────────────

export async function createNotification(data: InsertNotification): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values(data);
}

export async function getNotificationsByUser(userId: number): Promise<Notification[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
}

export async function markNotificationRead(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.userId, userId));
}

export async function getUnreadNotificationCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return Number(result[0]?.count ?? 0);
}

// ─── Statistics helpers ────────────────────────────────────────────────────────

export async function getDepartmentStats(fiscalYear: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      department: employees.department,
      totalGranted: sql<number>`SUM(${leaveBalances.totalGranted})`,
      totalUsed: sql<number>`SUM(${leaveBalances.used})`,
      employeeCount: sql<number>`COUNT(DISTINCT ${leaveBalances.userId})`,
    })
    .from(leaveBalances)
    .innerJoin(employees, eq(leaveBalances.userId, employees.userId))
    .where(eq(leaveBalances.fiscalYear, fiscalYear))
    .groupBy(employees.department);
  return result;
}

export async function getMonthlyLeaveStats(fiscalYear: number) {
  const db = await getDb();
  if (!db) return [];
  // Use raw SQL to avoid ONLY_FULL_GROUP_BY issues in TiDB:
  // GROUP BY alias (m) is supported in MySQL/TiDB and avoids the
  // "not in GROUP BY clause" error when SELECT expression differs from GROUP BY expression.
  const result = await db.execute(
    sql`SELECT
      MONTH(startDate) AS month,
      COUNT(*) AS count,
      SUM(totalDays) AS totalDays
    FROM leave_requests
    WHERE status = 'approved'
      AND startDate >= ${`${fiscalYear}-01-01`}
      AND startDate <= ${`${fiscalYear}-12-31`}
    GROUP BY month
    ORDER BY month`
  );
  // drizzle execute returns [rows, fields]; rows is an array of RowDataPacket
  const rows = (result as any)[0] as Array<{ month: number; count: number; totalDays: number }>;
  return rows.map((r) => ({
    month: Number(r.month),
    count: Number(r.count),
    totalDays: Number(r.totalDays),
  }));
}

export async function getAllLeaveRequestsForExport(fiscalYear: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      request: leaveRequests,
      user: users,
      employee: employees,
    })
    .from(leaveRequests)
    .innerJoin(users, eq(leaveRequests.userId, users.id))
    .leftJoin(employees, eq(leaveRequests.userId, employees.userId))
    .where(
      and(
        gte(leaveRequests.startDate, `${fiscalYear}-01-01` as any),
        lte(leaveRequests.startDate, `${fiscalYear}-12-31` as any)
      )
    )
    .orderBy(users.name, leaveRequests.startDate);
}

export async function getAllActiveUsersWithEmployees() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ user: users, employee: employees })
    .from(users)
    .innerJoin(employees, eq(users.id, employees.userId))
    .where(eq(employees.status, "active"));
}

// ─── Team helpers ────────────────────────────────────────────────────────────────────
export async function getAllTeams() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ team: teams, approver: users })
    .from(teams)
    .leftJoin(users, eq(teams.approverId, users.id))
    .orderBy(teams.name);
}

export async function getTeamById(teamId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({ team: teams, approver: users })
    .from(teams)
    .leftJoin(users, eq(teams.approverId, users.id))
    .where(eq(teams.id, teamId))
    .limit(1);
  return result[0];
}

export async function createTeam(data: InsertTeam): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(teams).values(data);
  return (result as any)[0]?.insertId ?? 0;
}

export async function updateTeam(teamId: number, data: Partial<InsertTeam>) {
  const db = await getDb();
  if (!db) return;
  await db.update(teams).set(data).where(eq(teams.id, teamId));
}

export async function deleteTeam(teamId: number) {
  const db = await getDb();
  if (!db) return;
  // Unassign employees from this team first
  await db.update(employees).set({ teamId: null }).where(eq(employees.teamId, teamId));
  await db.delete(teams).where(eq(teams.id, teamId));
}

export async function getTeamMembers(teamId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ user: users, employee: employees })
    .from(employees)
    .innerJoin(users, eq(employees.userId, users.id))
    .where(eq(employees.teamId, teamId));
}

export async function getTeamByApproverId(approverId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(teams).where(eq(teams.approverId, approverId));
}

export async function getPendingRequestsForTeam(teamId: number) {
  const db = await getDb();
  if (!db) return [];
  // Get all userIds in this team
  const members = await db
    .select({ userId: employees.userId })
    .from(employees)
    .where(eq(employees.teamId, teamId));
  if (members.length === 0) return [];
  const memberIds = members.map((m) => m.userId);
  return db
    .select({ request: leaveRequests, user: users, employee: employees })
    .from(leaveRequests)
    .innerJoin(users, eq(leaveRequests.userId, users.id))
    .leftJoin(employees, eq(leaveRequests.userId, employees.userId))
    .where(and(eq(leaveRequests.status, "pending"), inArray(leaveRequests.userId, memberIds)))
    .orderBy(desc(leaveRequests.createdAt));
}

export async function getAllRequestsForTeam(teamId: number) {
  const db = await getDb();
  if (!db) return [];
  const members = await db
    .select({ userId: employees.userId })
    .from(employees)
    .where(eq(employees.teamId, teamId));
  if (members.length === 0) return [];
  const memberIds = members.map((m) => m.userId);
  return db
    .select({ request: leaveRequests, user: users, employee: employees })
    .from(leaveRequests)
    .innerJoin(users, eq(leaveRequests.userId, users.id))
    .leftJoin(employees, eq(leaveRequests.userId, employees.userId))
    .where(inArray(leaveRequests.userId, memberIds))
    .orderBy(desc(leaveRequests.createdAt));
}
