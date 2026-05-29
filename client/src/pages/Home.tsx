import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import {
  CalendarCheck,
  CalendarDays,
  CalendarX,
  Clock,
  TrendingUp,
  ArrowRight,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: "연차",
  half_am: "오전 반차",
  half_pm: "오후 반차",
  sick: "병가",
  special: "특별 휴가",
  unpaid: "무급 휴가",
};

const STATUS_CONFIG = {
  pending:  { label: "대기중",  icon: <AlertCircle size={12} />, cls: "status-pending" },
  approved: { label: "승인됨",  icon: <CheckCircle size={12} />, cls: "status-approved" },
  rejected: { label: "반려됨",  icon: <XCircle size={12} />,    cls: "status-rejected" },
};

export default function Home() {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const [year] = useState(currentYear);

  const { data: balance, isLoading: balLoading } = trpc.leaveBalance.getMyBalance.useQuery({ fiscalYear: year });
  const { data: requests, isLoading: reqLoading } = trpc.leaveRequest.myList.useQuery({ fiscalYear: year });
  const { data: employee } = trpc.employee.getMyProfile.useQuery();

  const recent = (requests ?? []).slice(0, 5);
  const pending = (requests ?? []).filter((r: any) => r.status === "pending").length;

  const totalGranted = Number(balance?.totalGranted ?? 0);
  const used = Number(balance?.used ?? 0);
  const remaining = Number(balance?.remaining ?? 0);
  const usedPct = totalGranted > 0 ? Math.round((used / totalGranted) * 100) : 0;

  return (
    <DashboardLayout>
      {/* Welcome */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">
          안녕하세요, {user?.name ?? "사용자"}님! 👋
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {year}년 연차 현황을 확인하세요.
          {employee?.employee?.department && ` · ${employee.employee.department}`}
          {employee?.employee?.position && ` / ${employee.employee.position}`}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total granted */}
        <div className="stat-card interactive">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground">총 부여</span>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "oklch(93% 0.06 264)" }}>
              <CalendarDays size={15} style={{ color: "var(--color-primary)" }} />
            </div>
          </div>
          {balLoading ? (
            <div className="h-8 w-16 bg-muted rounded-lg animate-pulse" />
          ) : (
            <p className="text-3xl font-bold text-foreground">{totalGranted}<span className="text-base font-medium text-muted-foreground ml-1">일</span></p>
          )}
        </div>

        {/* Used */}
        <div className="stat-card interactive">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground">사용</span>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-amber-50">
              <CalendarCheck size={15} className="text-amber-600" />
            </div>
          </div>
          {balLoading ? (
            <div className="h-8 w-16 bg-muted rounded-lg animate-pulse" />
          ) : (
            <p className="text-3xl font-bold text-foreground">{used}<span className="text-base font-medium text-muted-foreground ml-1">일</span></p>
          )}
        </div>

        {/* Remaining */}
        <div className="stat-card interactive" style={{ background: "var(--color-primary)" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium" style={{ color: "oklch(85% 0.06 264)" }}>잔여</span>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/20">
              <TrendingUp size={15} className="text-white" />
            </div>
          </div>
          {balLoading ? (
            <div className="h-8 w-16 bg-white/20 rounded-lg animate-pulse" />
          ) : (
            <p className="text-3xl font-bold text-white">{remaining}<span className="text-base font-medium ml-1" style={{ color: "oklch(85% 0.06 264)" }}>일</span></p>
          )}
        </div>

        {/* Pending */}
        <div className="stat-card interactive">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground">대기중</span>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-amber-50">
              <Clock size={15} className="text-amber-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-foreground">{pending}<span className="text-base font-medium text-muted-foreground ml-1">건</span></p>
        </div>
      </div>

      {/* Usage progress + Quick action */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Usage bar */}
        <div className="lg:col-span-2 bg-card rounded-2xl p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">연차 사용률</h3>
            <span className="text-sm font-bold" style={{ color: "var(--color-primary)" }}>{usedPct}%</span>
          </div>
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden mb-3">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${usedPct}%`,
                background: usedPct > 80
                  ? "oklch(58% 0.22 27)"
                  : "var(--color-primary)",
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>사용 {used}일</span>
            <span>총 {totalGranted}일</span>
          </div>

          {/* Monthly mini chart */}
          {!reqLoading && requests && requests.length > 0 && (
            <div className="mt-5 pt-4 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-3">월별 사용 현황</p>
              <div className="flex items-end gap-1.5 h-12">
                {Array.from({ length: 12 }, (_, i) => {
                  const monthDays = (requests as any[])
                    .filter((r) => r.status === "approved" && new Date(r.startDate).getMonth() === i)
                    .reduce((s: number, r: any) => s + Number(r.totalDays), 0);
                  const maxDays = 5;
                  const pct = Math.min((monthDays / maxDays) * 100, 100);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full rounded-sm" style={{
                        height: `${Math.max(pct, 4)}%`,
                        background: monthDays > 0 ? "var(--color-primary)" : "var(--color-muted)",
                        minHeight: "4px",
                      }} />
                      <span className="text-xs text-muted-foreground" style={{ fontSize: "9px" }}>
                        {i + 1}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Quick action card */}
        <div className="card-blue flex flex-col justify-between">
          <div>
            <p className="text-sm font-medium text-white/80 mb-1">연차 신청</p>
            <p className="text-2xl font-bold text-white mb-2">잔여 {remaining}일</p>
            <p className="text-xs text-white/70">지금 바로 연차를 신청하세요</p>
          </div>
          <Link
            href="/leave/request"
            className="mt-6 flex items-center justify-between bg-white/20 hover:bg-white/30 transition-colors rounded-xl px-4 py-3 text-sm font-semibold text-white"
          >
            신청하기
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* Recent requests */}
      <div className="bg-card rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">최근 연차 신청</h3>
          <Link
            href="/leave/history"
            className="text-xs font-medium flex items-center gap-1"
            style={{ color: "var(--color-primary)" }}
          >
            전체 보기 <ArrowRight size={12} />
          </Link>
        </div>

        {reqLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarX size={32} className="text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-muted-foreground">연차 신청 내역이 없습니다</p>
            <Link href="/leave/request" className="mt-3 btn-primary text-xs py-1.5 px-3">
              첫 연차 신청하기
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recent.map((r: any) => {
              const st = STATUS_CONFIG[r.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
              return (
                <div key={r.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40 transition-colors">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "oklch(93% 0.06 264)" }}
                  >
                    <CalendarDays size={15} style={{ color: "var(--color-primary)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {LEAVE_TYPE_LABELS[r.leaveType] ?? r.leaveType}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.startDate ? new Date(r.startDate).toLocaleDateString("ko-KR") : "-"} ~ {r.endDate ? new Date(r.endDate).toLocaleDateString("ko-KR") : "-"} · {r.totalDays}일
                    </p>
                  </div>
                  <span className={st.cls}>
                    {st.icon}
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
