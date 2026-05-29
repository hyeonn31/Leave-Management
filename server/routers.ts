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
  getAllTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamMembers,
  getTeamByApproverId,
  getPendingRequestsForTeam,
  getAllRequestsForTeam,
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
      // Auto-recalculate leave balance when entryDate is provided
      if (input.entryDate) {
        const currentYear = new Date().getFullYear();
        const referenceDate = new Date(currentYear, 11, 31);
        const entitlement = calculateLeaveEntitlement(new Date(input.entryDate), referenceDate);
        const existingBalance = await getLeaveBalance(ctx.user.id, currentYear);
        const existingUsed = existingBalance ? existingBalance.used : "0";
        await upsertLeaveBalance({
          userId: ctx.user.id,
          fiscalYear: currentYear,
          totalGranted: String(entitlement.totalDays),
          used: existingUsed,
          remaining: String(Math.max(0, entitlement.totalDays - Number(existingUsed))),
        });
      }
      return { success: true };
    }),
  // Admin: list all employees
  listAll: adminProcedure.query(async () => {
    return getAllEmployeesWithUsers();
  }),
  // Admin: list all users (for employee registration dialog)
  listAllUsers: adminProcedure.query(async () => {
    return getAllUsers();
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
      // Use upsert so it works even if no employee row exists yet
      await upsertEmployee({ userId, ...empData } as any);
      if (role) await updateUserRole(userId, role);
      // Auto-recalculate leave balance when entryDate is updated
      if (input.entryDate) {
        const currentYear = new Date().getFullYear();
        const referenceDate = new Date(currentYear, 11, 31);
        const entitlement = calculateLeaveEntitlement(new Date(input.entryDate), referenceDate);
        const existingBalance = await getLeaveBalance(userId, currentYear);
        const existingUsed = existingBalance ? existingBalance.used : "0";
        await upsertLeaveBalance({
          userId,
          fiscalYear: currentYear,
          totalGranted: String(entitlement.totalDays),
          used: existingUsed,
          remaining: String(Math.max(0, entitlement.totalDays - Number(existingUsed))),
        });
      }
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
      // 기준일: 해당 연도 12월 31일로 고정 (연도 내 최대 부여 가능 일수 기준)
      // → 입사 당해연도 포함, 연도 말 기준 근속 개월 수를 반영
      const referenceDate = new Date(fiscalYear, 11, 31);
      const totalGranted = calculateLeaveEntitlement(entryDate, referenceDate).totalDays;
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
      // Auto-calculate leave balance when entryDate is provided
      if (input.entryDate) {
        const currentYear = new Date().getFullYear();
        const referenceDate = new Date(currentYear, 11, 31);
        const entitlement = calculateLeaveEntitlement(new Date(input.entryDate), referenceDate);
        const existingBalance = await getLeaveBalance(input.userId, currentYear);
        const existingUsed = existingBalance ? existingBalance.used : "0";
        await upsertLeaveBalance({
          userId: input.userId,
          fiscalYear: currentYear,
          totalGranted: String(entitlement.totalDays),
          used: existingUsed,
          remaining: String(Math.max(0, entitlement.totalDays - Number(existingUsed))),
        });
      }
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
      // Auto-calculate and create balance if not exists OR if totalGranted is 0 but entryDate exists
      const needsCalc = employee?.entryDate && (
        !balance || (Number(balance.totalGranted) === 0 && Number(balance.used) === 0)
      );
      if (needsCalc) {
        const referenceDate = new Date(year, 11, 31);
        const entryDateVal = employee!.entryDate;
        const entitlement = calculateLeaveEntitlement(new Date(entryDateVal instanceof Date ? entryDateVal : String(entryDateVal)), referenceDate);
        const existingUsed = balance ? balance.used : "0";
        const newTotal = entitlement.totalDays;
        const newRemaining = Math.max(0, newTotal - Number(existingUsed));
        const newBalance = {
          userId: ctx.user.id,
          fiscalYear: year,
          totalGranted: String(newTotal),
          used: existingUsed,
          remaining: String(newRemaining),
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
  // Admin: directly set balance values (override)
  setBalance: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        fiscalYear: z.number(),
        totalGranted: z.number().min(0),
        used: z.number().min(0),
        reason: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const remaining = Math.max(0, input.totalGranted - input.used);
      await upsertLeaveBalance({
        userId: input.userId,
        fiscalYear: input.fiscalYear,
        totalGranted: String(input.totalGranted),
        used: String(input.used),
        remaining: String(remaining),
      });
      await createLeaveAdjustment({
        userId: input.userId,
        fiscalYear: input.fiscalYear,
        adjustmentDays: String(input.totalGranted),
        reason: `[직접 설정] ${input.reason} (부여:${input.totalGranted}일, 사용:${input.used}일, 잔여:${remaining}일)`,
        adjustedBy: ctx.user.id,
      });
      const targetUser = await getUserById(input.userId);
      if (targetUser) {
        await createNotification({
          userId: input.userId,
          type: "leave_renewal",
          title: "연차 직접 수정",
          message: `${input.fiscalYear}년 연차가 관리자에 의해 수정되었습니다. 총 부여: ${input.totalGranted}일, 사용: ${input.used}일, 잔여: ${remaining}일. 사유: ${input.reason}`,
          relatedId: null,
        });
      }
      return { success: true, remaining };
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

  // Admin: per-employee leave overview (balance + history)
  // Shows ALL employees, even those without a leave_balance row for the year
  leaveOverview: adminProcedure
    .input(z.object({ fiscalYear: z.number() }))
    .query(async ({ input }) => {
      const [allEmployees, allBalances, allRequests] = await Promise.all([
        getAllEmployeesWithUsers(),
        getAllLeaveBalancesForYear(input.fiscalYear),
        getAllLeaveRequestsForExport(input.fiscalYear),
      ]);
      // Map userId -> balance
      const balanceByUser = new Map(allBalances.map((b) => [b.user.id, b]));
      // Map userId -> requests
      const requestsByUser = new Map<number, typeof allRequests>();
      for (const r of allRequests) {
        const uid = r.user.id;
        if (!requestsByUser.has(uid)) requestsByUser.set(uid, []);
        requestsByUser.get(uid)!.push(r);
      }
      return allEmployees.map(({ user, employee }) => {
        const b = balanceByUser.get(user.id);
        return {
          user,
          employee: employee ?? null,
          balance: b
            ? b.balance
            : { totalGranted: '0', used: '0', remaining: '0', fiscalYear: input.fiscalYear },
          requests: requestsByUser.get(user.id) ?? [],
        };
      });
    }),

  // Admin: grant special leave (e.g. weekend work compensation)
  grantSpecialLeave: adminProcedure
    .input(
      z.object({
        userIds: z.array(z.number()).min(1),
        fiscalYear: z.number(),
        days: z.number().min(0.5).max(30),
        reason: z.string().min(1),
        workDate: z.string(), // YYYY-MM-DD of the weekend worked
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Server-side weekend validation
      const workDay = new Date(input.workDate);
      const dayOfWeek = workDay.getUTCDay(); // 0=Sun, 6=Sat
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `${input.workDate}은 주말이 아닙니다 (${['일','월','화','수','목','금','토'][dayOfWeek]}요일). 주말 출근 보상 연차는 토요일 또는 일요일 날짜만 입력 가능합니다.`,
        });
      }
      const results: { userId: number; success: boolean }[] = [];
      for (const userId of input.userIds) {
        try {
          // 1. Upsert balance — add granted days
          const existing = await getLeaveBalance(userId, input.fiscalYear);
          if (existing) {
            const newTotal = Number(existing.totalGranted) + input.days;
            const newRemaining = Number(existing.remaining) + input.days;
            await upsertLeaveBalance({
              userId,
              fiscalYear: input.fiscalYear,
              totalGranted: String(newTotal),
              used: existing.used,
              remaining: String(newRemaining),
            });
          } else {
            // 기존 연차 쟑여일수가 없으면 입사일 기준 법정 연차를 계산하여 초기화
            const emp = await getEmployeeByUserId(userId);
            let baseLegal = 0;
            if (emp?.entryDate) {
              const refDate = new Date(input.fiscalYear, 11, 31);
              baseLegal = calculateLeaveEntitlement(new Date(emp.entryDate), refDate).totalDays;
            }
            const newTotal = baseLegal + input.days;
            await upsertLeaveBalance({
              userId,
              fiscalYear: input.fiscalYear,
              totalGranted: String(newTotal),
              used: '0',
              remaining: String(newTotal),
            });
          }
          // 2. Record as leave adjustment for audit trail
          await createLeaveAdjustment({
            userId,
            fiscalYear: input.fiscalYear,
            adjustmentDays: String(input.days),
            reason: `[주말출근 보상] ${input.workDate} 출근 — ${input.reason}`,
            adjustedBy: ctx.user.id,
          });
          // 3. Notify the employee
          await createNotification({
            userId,
            type: 'leave_approved',
            title: '특별 연차 부여',
            message: `${input.fiscalYear}년 특별 연차 ${input.days}일이 부여되었습니다. 사유: ${input.workDate} 주말 출근 보상 (${input.reason})`,
          });
          results.push({ userId, success: true });
        } catch {
          results.push({ userId, success: false });
        }
      }
      return { results, granted: results.filter((r) => r.success).length };
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

// ─── Team Router ──────────────────────────────────────────────────────────────
const teamRouter = router({
  listAll: adminProcedure.query(async () => getAllTeams()),
  create: adminProcedure
    .input(z.object({ name: z.string().min(1), description: z.string().optional(), approverId: z.number().optional() }))
    .mutation(async ({ input }) => {
      const id = await createTeam({ name: input.name, description: input.description ?? null, approverId: input.approverId ?? null });
      return { id };
    }),
  update: adminProcedure
    .input(z.object({ teamId: z.number(), name: z.string().min(1).optional(), description: z.string().optional(), approverId: z.number().nullable().optional() }))
    .mutation(async ({ input }) => {
      const { teamId, ...data } = input;
      await updateTeam(teamId, data as any);
      return { success: true };
    }),
  delete: adminProcedure
    .input(z.object({ teamId: z.number() }))
    .mutation(async ({ input }) => {
      await deleteTeam(input.teamId);
      return { success: true };
    }),
  assignEmployee: adminProcedure
    .input(z.object({ userId: z.number(), teamId: z.number().nullable() }))
    .mutation(async ({ input }) => {
      const db = await import("./db");
      await db.updateEmployee(input.userId, { teamId: input.teamId } as any);
      return { success: true };
    }),
  getMyTeams: protectedProcedure.query(async ({ ctx }) => getTeamByApproverId(ctx.user.id)),
  getPendingRequests: protectedProcedure.query(async ({ ctx }) => {
    const myTeams = await getTeamByApproverId(ctx.user.id);
    if (myTeams.length === 0) return [];
    const all: any[] = [];
    for (const team of myTeams) {
      const reqs = await getPendingRequestsForTeam(team.id);
      all.push(...reqs.map((r) => ({ ...r, teamId: team.id, teamName: team.name })));
    }
    return all;
  }),
  getAllRequests: protectedProcedure.query(async ({ ctx }) => {
    const myTeams = await getTeamByApproverId(ctx.user.id);
    if (myTeams.length === 0) return [];
    const all: any[] = [];
    for (const team of myTeams) {
      const reqs = await getAllRequestsForTeam(team.id);
      all.push(...reqs.map((r) => ({ ...r, teamId: team.id, teamName: team.name })));
    }
    return all;
  }),
  approveRequest: protectedProcedure
    .input(z.object({ requestId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const request = await getLeaveRequestById(input.requestId);
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "신청 건을 찾을 수 없습니다." });
      const myTeams = await getTeamByApproverId(ctx.user.id);
      const myTeamIds = myTeams.map((t) => t.id);
      const emp = await getEmployeeByUserId(request.userId);
      if (ctx.user.role !== "admin" && (!emp?.teamId || !myTeamIds.includes(emp.teamId))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "해당 직원의 팀장이 아닙니다." });
      }
      await updateLeaveRequestStatus(input.requestId, "approved", ctx.user.id);
      await createNotification({ userId: request.userId, type: "team_leave_approved", title: "팀장 승인 완료", message: `${request.startDate} ~ ${request.endDate} 연차 신청이 팀장에 의해 승인되었습니다.`, relatedId: input.requestId });
      return { success: true };
    }),
  rejectRequest: protectedProcedure
    .input(z.object({ requestId: z.number(), reason: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const request = await getLeaveRequestById(input.requestId);
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "신청 건을 찾을 수 없습니다." });
      const myTeams = await getTeamByApproverId(ctx.user.id);
      const myTeamIds = myTeams.map((t) => t.id);
      const emp = await getEmployeeByUserId(request.userId);
      if (ctx.user.role !== "admin" && (!emp?.teamId || !myTeamIds.includes(emp.teamId))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "해당 직원의 팀장이 아닙니다." });
      }
      await updateLeaveRequestStatus(input.requestId, "rejected", ctx.user.id, input.reason);
      await createNotification({ userId: request.userId, type: "team_leave_rejected", title: "팀장 반려", message: `${request.startDate} ~ ${request.endDate} 연차 신청이 반려되었습니다. 사유: ${input.reason}`, relatedId: input.requestId });
      return { success: true };
    }),
});
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
  team: teamRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
