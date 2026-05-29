import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import {
  upsertUser,
  getUserByOpenId,
  getAllUsers,
  getUserById,
  updateUserRole,
  getEmployeeByUserId,
  upsertEmployee,
  getAllEmployeesWithUsers,
  updateEmployee,
  getLeaveBalance,
  upsertLeaveBalance,
  getAllLeaveBalancesForYear,
  updateLeaveBalanceUsed,
  createLeaveRequest,
  getLeaveRequestById,
  getLeaveRequestsByUser,
  getAllLeaveRequests,
  updateLeaveRequestStatus,
  cancelLeaveRequest,
  createLeaveAdjustment,
  getLeaveAdjustmentsByUser,
  createNotification,
  getNotificationsByUser,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationCount,
  getDepartmentStats,
  getMonthlyLeaveStats,
  getAllLeaveRequestsForExport,
  getAllLeaveBalancesForYear as getAllBalances,
  getAllActiveUsersWithEmployees,
} from "./db";
import { calculateLeaveEntitlement, calculateDaysForLeaveType, calculateGrantedDaysForYear } from "./leaveCalc";
import { notifyOwner } from "./_core/notification";

// ─── Admin guard ───────────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
  }
  return next({ ctx });
});

// ─── Employee router ───────────────────────────────────────────────────────────
const employeeRouter = router({
  getMyProfile: protectedProcedure.query(async ({ ctx }) => {
    const employee = await getEmployeeByUserId(ctx.user.id);
    return { user: ctx.user, employee: employee ?? null };
  }),

  updateMyProfile: protectedProcedure
    .input(
      z.object({
        employeeNumber: z.string().optional(),
        department: z.string().optional(),
        position: z.string().optional(),
        entryDate: z.string().optional(), // ISO date string
      })
    )
    .mutation(async ({ ctx, input }) => {
      await upsertEmployee({
        userId: ctx.user.id,
        employeeNumber: input.employeeNumber,
        department: input.department,
        position: input.position,
        entryDate: input.entryDate as any,
        status: "active",
      });
      return { success: true };
    }),

  // Admin: list all employees
  listAll: adminProcedure.query(async () => {
    return getAllEmployeesWithUsers();
  }),

  // Admin: update employee
  adminUpdate: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        employeeNumber: z.string().optional(),
        department: z.string().optional(),
        position: z.string().optional(),
        entryDate: z.string().optional(),
        status: z.enum(["active", "resigned", "on_leave"]).optional(),
        role: z.enum(["user", "admin"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { userId, role, ...empData } = input;
      await updateEmployee(userId, empData as any);
      if (role) await updateUserRole(userId, role);
      return { success: true };
    }),

  // Admin: recalculate leave balance for a specific user and fiscal year
  recalcLeave: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        fiscalYear: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const employee = await getEmployeeByUserId(input.userId);
      if (!employee?.entryDate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "입사일이 등록되지 않아 연차를 계산할 수 없습니다.",
        });
      }

      const entryDate = new Date(employee.entryDate);
      const fiscalYear = input.fiscalYear;

      // 1) 해당 연도에 승인된 연차 신청의 실제 사용 일수를 집계
      const requests = await getLeaveRequestsByUser(input.userId, fiscalYear);
      const usedDays = requests
        .filter((r) => r.status === "approved")
        .reduce((sum, r) => sum + Number(r.totalDays), 0);

      // 2) 입사일 기준으로 해당 연도의 법정 부여 일수 재계산
      const totalGranted = calculateGrantedDaysForYear(entryDate, fiscalYear, "entry_date");
      const remaining = Math.max(0, totalGranted - usedDays);

      // 3) leave_balances upsert (totalGranted + used 재설정, remaining 재계산)
      await upsertLeaveBalance({
        userId: input.userId,
        fiscalYear,
        totalGranted: String(totalGranted),
        used: String(usedDays),
        remaining: String(remaining),
      });

      return { totalGranted, usedDays, remaining };
    }),
  // Admin: create employee profile for existing user
  adminCreate: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        employeeNumber: z.string().optional(),
        department: z.string().optional(),
        position: z.string().optional(),
        entryDate: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await upsertEmployee({
        userId: input.userId,
        employeeNumber: input.employeeNumber,
        department: input.department,
        position: input.position,
        entryDate: input.entryDate as any,
        status: "active",
      });
      return { success: true };
    }),
});

// ─── Leave Balance router ──────────────────────────────────────────────────────
const leaveBalanceRouter = router({
  getMyBalance: protectedProcedure
    .input(z.object({ fiscalYear: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const year = input.fiscalYear ?? new Date().getFullYear();
      const balance = await getLeaveBalance(ctx.user.id, year);
      const employee = await getEmployeeByUserId(ctx.user.id);

      // Auto-calculate and create balance if not exists
      if (!balance && employee?.entryDate) {
        const entitlement = calculateLeaveEntitlement(new Date(employee.entryDate));
        const newBalance = {
          userId: ctx.user.id,
          fiscalYear: year,
          totalGranted: String(entitlement.totalDays),
          used: "0",
          remaining: String(entitlement.totalDays),
        };
        await upsertLeaveBalance(newBalance);
        return newBalance;
      }

      return balance ?? null;
    }),

  getMyBalanceHistory: protectedProcedure.query(async ({ ctx }) => {
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];
    const results = await Promise.all(
      years.map((y) => getLeaveBalance(ctx.user.id, y))
    );
    return results.filter(Boolean);
  }),

  // Admin: get all balances for a year
  getAllForYear: adminProcedure
    .input(z.object({ fiscalYear: z.number() }))
    .query(async ({ input }) => {
      return getAllLeaveBalancesForYear(input.fiscalYear);
    }),

  // Admin: manual adjustment
  adjust: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        fiscalYear: z.number(),
        adjustmentDays: z.number(),
        reason: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const balance = await getLeaveBalance(input.userId, input.fiscalYear);
      if (!balance) {
        throw new TRPCError({ code: "NOT_FOUND", message: "해당 연도의 연차 잔액이 없습니다." });
      }

      const newTotal = Number(balance.totalGranted) + input.adjustmentDays;
      const newRemaining = Number(balance.remaining) + input.adjustmentDays;

      await upsertLeaveBalance({
        userId: input.userId,
        fiscalYear: input.fiscalYear,
        totalGranted: String(Math.max(0, newTotal)),
        used: balance.used,
        remaining: String(Math.max(0, newRemaining)),
      });

      await createLeaveAdjustment({
        userId: input.userId,
        fiscalYear: input.fiscalYear,
        adjustmentDays: String(input.adjustmentDays),
        reason: input.reason,
        adjustedBy: ctx.user.id,
      });

      // Notify user
      const targetUser = await getUserById(input.userId);
      if (targetUser) {
        await createNotification({
          userId: input.userId,
          type: "leave_renewal",
          title: "연차 수동 조정",
          message: `${input.fiscalYear}년 연차가 ${input.adjustmentDays > 0 ? "+" : ""}${input.adjustmentDays}일 조정되었습니다. 사유: ${input.reason}`,
          relatedId: null,
        });
      }

      return { success: true };
    }),
});

// ─── Leave Request router ──────────────────────────────────────────────────────
const leaveRequestRouter = router({
  submit: protectedProcedure
    .input(
      z.object({
        leaveType: z.enum(["annual", "half_am", "half_pm", "sick", "special", "unpaid"]),
        startDate: z.string(),
        endDate: z.string(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const employee = await getEmployeeByUserId(ctx.user.id);
      if (!employee?.entryDate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "입사일이 등록되지 않았습니다. 프로필을 먼저 등록해주세요.",
        });
      }

      const totalDays = calculateDaysForLeaveType(
        input.leaveType,
        new Date(input.startDate),
        new Date(input.endDate)
      );

      if (totalDays <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "유효한 날짜 범위를 선택해주세요." });
      }

      // Check balance for annual/half leaves
      if (["annual", "half_am", "half_pm"].includes(input.leaveType)) {
        const year = new Date(input.startDate).getFullYear();
        const balance = await getLeaveBalance(ctx.user.id, year);
        if (!balance || Number(balance.remaining) < totalDays) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `잔여 연차가 부족합니다. (잔여: ${balance ? balance.remaining : 0}일, 신청: ${totalDays}일)`,
          });
        }
      }

      const requestId = await createLeaveRequest({
        userId: ctx.user.id,
        leaveType: input.leaveType,
        startDate: input.startDate as any,
        endDate: input.endDate as any,
        totalDays: String(totalDays),
        reason: input.reason,
        status: "pending",
      });

      // Notify all admins
      const allUsers = await getAllUsers();
      const admins = allUsers.filter((u) => u.role === "admin");
      for (const admin of admins) {
        await createNotification({
          userId: admin.id,
          type: "leave_request_submitted",
          title: "새 연차 신청",
          message: `${ctx.user.name ?? "직원"}님이 연차를 신청했습니다. (${input.startDate} ~ ${input.endDate}, ${totalDays}일)`,
          relatedId: requestId,
        });
      }

      // Also notify owner via Manus notification
      await notifyOwner({
        title: "새 연차 신청",
        content: `${ctx.user.name ?? "직원"}님이 연차를 신청했습니다. (${input.startDate} ~ ${input.endDate}, ${totalDays}일)`,
      });

      return { success: true, requestId };
    }),

  myList: protectedProcedure
    .input(z.object({ fiscalYear: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      return getLeaveRequestsByUser(ctx.user.id, input.fiscalYear);
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const request = await getLeaveRequestById(input.id);
      if (!request) throw new TRPCError({ code: "NOT_FOUND" });
      if (request.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (request.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "대기 중인 신청만 취소할 수 있습니다." });
      }
      await cancelLeaveRequest(input.id);
      return { success: true };
    }),

  // Admin: list all requests
  adminList: adminProcedure
    .input(z.object({ status: z.enum(["pending", "approved", "rejected"]).optional() }))
    .query(async ({ input }) => {
      return getAllLeaveRequests(input.status);
    }),

  // Admin: approve or reject
  decide: adminProcedure
    .input(
      z.object({
        id: z.number(),
        decision: z.enum(["approved", "rejected"]),
        rejectionReason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const request = await getLeaveRequestById(input.id);
      if (!request) throw new TRPCError({ code: "NOT_FOUND" });
      if (request.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "이미 처리된 신청입니다." });
      }

      await updateLeaveRequestStatus(
        input.id,
        input.decision,
        ctx.user.id,
        input.rejectionReason
      );

      // Update balance if approved for annual/half leaves
      if (
        input.decision === "approved" &&
        ["annual", "half_am", "half_pm"].includes(request.leaveType)
      ) {
        const year = new Date(request.startDate).getFullYear();
        await updateLeaveBalanceUsed(request.userId, year, Number(request.totalDays));
      }

      // Notify the requester
      const isApproved = input.decision === "approved";
      await createNotification({
        userId: request.userId,
        type: isApproved ? "leave_approved" : "leave_rejected",
        title: isApproved ? "연차 신청 승인" : "연차 신청 반려",
        message: isApproved
          ? `연차 신청이 승인되었습니다. (${request.startDate} ~ ${request.endDate}, ${request.totalDays}일)`
          : `연차 신청이 반려되었습니다. 사유: ${input.rejectionReason ?? "없음"}`,
        relatedId: input.id,
      });

      return { success: true };
    }),
});

// ─── Notification router ───────────────────────────────────────────────────────
const notificationRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getNotificationsByUser(ctx.user.id);
  }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return getUnreadNotificationCount(ctx.user.id);
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await markNotificationRead(input.id, ctx.user.id);
      return { success: true };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await markAllNotificationsRead(ctx.user.id);
    return { success: true };
  }),
});

// ─── Admin Stats router ────────────────────────────────────────────────────────
const adminRouter = router({
  departmentStats: adminProcedure
    .input(z.object({ fiscalYear: z.number() }))
    .query(async ({ input }) => {
      return getDepartmentStats(input.fiscalYear);
    }),

  monthlyStats: adminProcedure
    .input(z.object({ fiscalYear: z.number() }))
    .query(async ({ input }) => {
      return getMonthlyLeaveStats(input.fiscalYear);
    }),

  summary: adminProcedure
    .input(z.object({ fiscalYear: z.number() }))
    .query(async ({ input }) => {
      const [allBalances, pendingRequests, allEmployees] = await Promise.all([
        getAllLeaveBalancesForYear(input.fiscalYear),
        getAllLeaveRequests("pending"),
        getAllEmployeesWithUsers(),
      ]);

      const totalEmployees = allEmployees.filter((e) => e.employee?.status === "active").length;
      const totalGranted = allBalances.reduce((s, b) => s + Number(b.balance.totalGranted), 0);
      const totalUsed = allBalances.reduce((s, b) => s + Number(b.balance.used), 0);
      const usageRate = totalGranted > 0 ? Math.round((totalUsed / totalGranted) * 100) : 0;

      return {
        totalEmployees,
        totalGranted,
        totalUsed,
        usageRate,
        pendingCount: pendingRequests.length,
      };
    }),

  exportCsv: adminProcedure
    .input(z.object({ fiscalYear: z.number() }))
    .query(async ({ input }) => {
      const rows = await getAllLeaveRequestsForExport(input.fiscalYear);
      const leaveTypeLabel: Record<string, string> = {
        annual: "연차",
        half_am: "오전 반차",
        half_pm: "오후 반차",
        sick: "병가",
        special: "특별 휴가",
        unpaid: "무급 휴가",
      };
      const statusLabel: Record<string, string> = {
        pending: "대기",
        approved: "승인",
        rejected: "반려",
      };

      const header = "이름,사번,부서,직급,연차종류,시작일,종료일,일수,상태,사유,신청일";
      const lines = rows.map((r) =>
        [
          r.user.name ?? "",
          r.employee?.employeeNumber ?? "",
          r.employee?.department ?? "",
          r.employee?.position ?? "",
          leaveTypeLabel[r.request.leaveType] ?? r.request.leaveType,
          r.request.startDate,
          r.request.endDate,
          r.request.totalDays,
          statusLabel[r.request.status] ?? r.request.status,
          (r.request.reason ?? "").replace(/,/g, " "),
          r.request.createdAt.toISOString().split("T")[0],
        ].join(",")
      );

      return { csv: [header, ...lines].join("\n") };
    }),
});

// ─── Leave Renewal handler (called by heartbeat) ───────────────────────────────
export async function handleLeaveRenewal() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const allUsers = await getAllActiveUsersWithEmployees();

  let renewed = 0;
  for (const { user, employee } of allUsers) {
    if (!employee?.entryDate) continue;

    const entryDate = new Date(employee.entryDate);
    const entryMonth = entryDate.getMonth();
    const entryDay = entryDate.getDate();

    // Check if today is the anniversary (entry date month/day matches today)
    const isAnniversary =
      today.getMonth() === entryMonth && today.getDate() === entryDay;

    if (!isAnniversary) continue;

    const entitlement = calculateLeaveEntitlement(entryDate, today);
    const existingBalance = await getLeaveBalance(user.id, currentYear);

    if (!existingBalance) {
      await upsertLeaveBalance({
        userId: user.id,
        fiscalYear: currentYear,
        totalGranted: String(entitlement.totalDays),
        used: "0",
        remaining: String(entitlement.totalDays),
      });
    } else {
      // Update total granted (seniority may have increased)
      const additionalDays = entitlement.totalDays - Number(existingBalance.totalGranted);
      if (additionalDays > 0) {
        await upsertLeaveBalance({
          userId: user.id,
          fiscalYear: currentYear,
          totalGranted: String(entitlement.totalDays),
          used: existingBalance.used,
          remaining: String(Number(existingBalance.remaining) + additionalDays),
        });
      }
    }

    await createNotification({
      userId: user.id,
      type: "leave_renewal",
      title: "연차 갱신 완료",
      message: `${currentYear}년 연차가 갱신되었습니다. 총 ${entitlement.totalDays}일 (근속 ${entitlement.yearsOfService}년)`,
      relatedId: null,
    });

    renewed++;
  }

  return { renewed, processedAt: today.toISOString() };
}

// ─── App Router ────────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  employee: employeeRouter,
  leaveBalance: leaveBalanceRouter,
  leaveRequest: leaveRequestRouter,
  notification: notificationRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
