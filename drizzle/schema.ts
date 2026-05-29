import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  date,
  boolean,
  index,
} from "drizzle-orm/mysql-core";

// ─── Core Auth Table ───────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Employee Profiles ─────────────────────────────────────────────────────────
export const employees = mysqlTable("employees", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  employeeNumber: varchar("employeeNumber", { length: 32 }).unique(),
  department: varchar("department", { length: 100 }),
  position: varchar("position", { length: 100 }),
  entryDate: date("entryDate"),
  status: mysqlEnum("status", ["active", "resigned", "on_leave"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = typeof employees.$inferInsert;

// ─── Leave Balances ────────────────────────────────────────────────────────────
export const leaveBalances = mysqlTable(
  "leave_balances",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    fiscalYear: int("fiscalYear").notNull(),
    totalGranted: decimal("totalGranted", { precision: 5, scale: 1 }).notNull().default("0"),
    used: decimal("used", { precision: 5, scale: 1 }).notNull().default("0"),
    remaining: decimal("remaining", { precision: 5, scale: 1 }).notNull().default("0"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index("idx_leave_balances_user_year").on(t.userId, t.fiscalYear)]
);

export type LeaveBalance = typeof leaveBalances.$inferSelect;
export type InsertLeaveBalance = typeof leaveBalances.$inferInsert;

// ─── Leave Requests ────────────────────────────────────────────────────────────
export const leaveRequests = mysqlTable(
  "leave_requests",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    leaveType: mysqlEnum("leaveType", [
      "annual",       // 연차
      "half_am",      // 오전 반차
      "half_pm",      // 오후 반차
      "sick",         // 병가
      "special",      // 특별 휴가
      "unpaid",       // 무급 휴가
    ]).notNull(),
    startDate: date("startDate").notNull(),
    endDate: date("endDate").notNull(),
    totalDays: decimal("totalDays", { precision: 5, scale: 1 }).notNull(),
    reason: text("reason"),
    status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
    approverId: int("approverId"),
    rejectionReason: text("rejectionReason"),
    approvedAt: timestamp("approvedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index("idx_leave_requests_user").on(t.userId),
    index("idx_leave_requests_status").on(t.status),
  ]
);

export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type InsertLeaveRequest = typeof leaveRequests.$inferInsert;

// ─── Leave Adjustments (Manual) ────────────────────────────────────────────────
export const leaveAdjustments = mysqlTable("leave_adjustments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  fiscalYear: int("fiscalYear").notNull(),
  adjustmentDays: decimal("adjustmentDays", { precision: 5, scale: 1 }).notNull(),
  reason: text("reason").notNull(),
  adjustedBy: int("adjustedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LeaveAdjustment = typeof leaveAdjustments.$inferSelect;
export type InsertLeaveAdjustment = typeof leaveAdjustments.$inferInsert;

// ─── Notifications ─────────────────────────────────────────────────────────────
export const notifications = mysqlTable(
  "notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    type: mysqlEnum("type", [
      "leave_request_submitted",
      "leave_approved",
      "leave_rejected",
      "leave_renewal",
    ]).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    message: text("message").notNull(),
    relatedId: int("relatedId"),
    isRead: boolean("isRead").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("idx_notifications_user").on(t.userId, t.isRead)]
);

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
