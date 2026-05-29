import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { CalendarDays, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";
import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: "연차",
  half_am: "오전 반차",
  half_pm: "오후 반차",
  sick: "병가",
  special: "특별 휴가",
  unpaid: "무급 휴가",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "대기",
  approved: "승인",
  rejected: "반려",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-amber-600 bg-amber-50",
  approved: "text-green-700 bg-green-50",
  rejected: "text-red-600 bg-red-50",
};

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const currentYear = new Date().getFullYear();

  const { data: balance, isLoading: balanceLoading } = trpc.leaveBalance.getMyBalance.useQuery({
    fiscalYear: currentYear,
  });
  const { data: recentRequests, isLoading: requestsLoading } = trpc.leaveRequest.myList.useQuery({
    fiscalYear: currentYear,
  });

  const totalGranted = Number(balance?.totalGranted ?? 0);
  const used = Number(balance?.used ?? 0);
  const remaining = Number(balance?.remaining ?? 0);
  const usageRate = totalGranted > 0 ? Math.round((used / totalGranted) * 100) : 0;

  const chartData = [
    { name: "사용", value: used, color: "#1a1a1a" },
    { name: "잔여", value: remaining, color: "#e5e5e5" },
  ];

  const pendingCount = recentRequests?.filter((r) => r.status === "pending").length ?? 0;

  return (
    <div className="p-8 max-w-5xl animate-fade-in">
      {/* Page header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-4 h-4 bg-red-accent" />
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            {currentYear}년 연차 현황
          </p>
        </div>
        <h1 className="text-4xl font-black tracking-tight">
          안녕하세요, {user?.name ?? "직원"}님
        </h1>
        <div className="its-rule mt-4" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 mb-10 border border-border">
        <StatCard
          label="총 부여 연차"
          value={balanceLoading ? "—" : `${totalGranted}일`}
          icon={<CalendarDays className="h-5 w-5" />}
          accent={false}
        />
        <StatCard
          label="사용 연차"
          value={balanceLoading ? "—" : `${used}일`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent={false}
          border
        />
        <StatCard
          label="잔여 연차"
          value={balanceLoading ? "—" : `${remaining}일`}
          icon={<TrendingUp className="h-5 w-5" />}
          accent
          border
        />
      </div>

      {/* Main content: chart + recent requests */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Usage chart */}
        <div className="border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold uppercase tracking-widest">연차 소진율</h2>
            <span className="font-mono text-2xl font-black">{usageRate}%</span>
          </div>

          {totalGranted > 0 ? (
            <>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => [`${v}일`]}
                      contentStyle={{ border: "1px solid #e5e5e5", borderRadius: 0, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-6 mt-4">
                {chartData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-3 h-3" style={{ background: d.color }} />
                    <span className="text-xs text-muted-foreground font-mono">
                      {d.name} {d.value}일
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">
                입사일을 등록하면 연차가 자동 산정됩니다.
              </p>
            </div>
          )}

          {/* Progress bar */}
          <div className="mt-4">
            <div className="h-1 bg-border w-full">
              <div
                className="h-1 bg-foreground transition-all duration-500"
                style={{ width: `${usageRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Recent requests */}
        <div className="border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold uppercase tracking-widest">최근 신청 내역</h2>
            {pendingCount > 0 && (
              <span className="bg-red-accent text-white text-[10px] font-mono px-2 py-0.5">
                대기 {pendingCount}건
              </span>
            )}
          </div>

          {requestsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-muted animate-pulse" />
              ))}
            </div>
          ) : recentRequests && recentRequests.length > 0 ? (
            <div className="space-y-0">
              {recentRequests.slice(0, 5).map((req, i) => (
                <div
                  key={req.id}
                  className={`flex items-center justify-between py-3 ${
                    i < recentRequests.slice(0, 5).length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium">
                      {LEAVE_TYPE_LABELS[req.leaveType] ?? req.leaveType}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {String(req.startDate)} ~ {String(req.endDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">
                      {Number(req.totalDays)}일
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 uppercase ${STATUS_COLORS[req.status]}`}
                    >
                      {STATUS_LABELS[req.status]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <Clock className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">신청 내역이 없습니다.</p>
            </div>
          )}

          <button
            onClick={() => setLocation("/leave/request")}
            className="mt-6 w-full h-10 border border-foreground text-sm font-semibold uppercase tracking-widest hover:bg-foreground hover:text-background transition-colors btn-press"
          >
            연차 신청하기
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
  border,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
  border?: boolean;
}) {
  return (
    <div
      className={`p-6 ${border ? "border-l border-border" : ""} ${
        accent ? "bg-foreground text-background" : "bg-background"
      }`}
    >
      <div className={`mb-4 ${accent ? "text-white/60" : "text-muted-foreground"}`}>{icon}</div>
      <p className={`text-3xl font-black font-mono mb-1`}>{value}</p>
      <p className={`text-xs uppercase tracking-widest font-medium ${accent ? "text-white/70" : "text-muted-foreground"}`}>
        {label}
      </p>
    </div>
  );
}
