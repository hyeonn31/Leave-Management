import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { CalendarDays, CalendarX, CheckCircle, AlertCircle, XCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: "연차",
  half_am: "오전 반차",
  half_pm: "오후 반차",
  sick: "병가",
  special: "특별 휴가",
  unpaid: "무급 휴가",
};

const STATUS_CONFIG = {
  pending:  { label: "대기중",  icon: <AlertCircle size={11} />, cls: "status-pending" },
  approved: { label: "승인됨",  icon: <CheckCircle size={11} />, cls: "status-approved" },
  rejected: { label: "반려됨",  icon: <XCircle size={11} />,    cls: "status-rejected" },
};

export default function LeaveHistory() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Admin has no personal leave — redirect to admin dashboard
  if (user?.role === "admin") {
    setLocation("/admin");
    return null;
  }

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const years = [currentYear - 1, currentYear];

  const { data: balance } = trpc.leaveBalance.getMyBalance.useQuery({ fiscalYear: selectedYear });
  const { data: requests, isLoading } = trpc.leaveRequest.myList.useQuery({ fiscalYear: selectedYear });
  const utils = trpc.useUtils();

  const cancel = trpc.leaveRequest.cancel.useMutation({
    onSuccess: () => {
      toast.success("연차 신청이 취소되었습니다.");
      utils.leaveRequest.myList.invalidate();
      utils.leaveBalance.getMyBalance.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <DashboardLayout>
      {/* Year tabs */}
      <div className="flex items-center gap-2 mb-6">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => setSelectedYear(y)}
            className={`pill-tab ${selectedYear === y ? "active" : ""}`}
          >
            {y}년
          </button>
        ))}
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "총 부여", value: balance?.totalGranted ?? 0, color: "var(--color-primary)" },
          { label: "사용",    value: balance?.used ?? 0,         color: "oklch(75% 0.18 85)" },
          { label: "잔여",    value: balance?.remaining ?? 0,    color: "oklch(60% 0.18 145)" },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-2xl p-4 shadow-card text-center">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className="text-2xl font-bold" style={{ color: s.color }}>
              {Number(s.value)}<span className="text-sm font-medium text-muted-foreground ml-0.5">일</span>
            </p>
          </div>
        ))}
      </div>

      {/* Requests list */}
      <div className="bg-card rounded-2xl shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground">{selectedYear}년 연차 신청 내역</h3>
            <p className="text-xs text-muted-foreground mt-0.5">총 {(requests ?? []).length}건</p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (requests ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarX size={36} className="text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-muted-foreground">{selectedYear}년 연차 신청 내역이 없습니다</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {(requests as any[]).map((r) => {
              const st = STATUS_CONFIG[r.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
              return (
                <div key={r.id} className="hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "oklch(93% 0.06 264)" }}
                    >
                      <CalendarDays size={16} style={{ color: "var(--color-primary)" }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-foreground">
                          {LEAVE_TYPE_LABELS[r.leaveType] ?? r.leaveType}
                        </p>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {r.totalDays}일
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.startDate).toLocaleDateString("ko-KR")} ~ {new Date(r.endDate).toLocaleDateString("ko-KR")}
                        {r.reason && ` · ${r.reason}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className={st.cls}>
                        {st.icon}
                        {st.label}
                      </span>
                      <span className="text-xs text-muted-foreground hidden sm:block">
                        {new Date(r.createdAt).toLocaleDateString("ko-KR")}
                      </span>
                      {r.status === "pending" && (
                        <button
                          onClick={() => {
                            if (confirm("연차 신청을 취소하시겠습니까?")) cancel.mutate({ id: r.id });
                          }}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="취소"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  {r.status === "rejected" && r.rejectionReason && (
                    <div className="px-5 pb-3 -mt-1 ml-14">
                      <p className="text-xs text-destructive bg-red-50 px-3 py-1.5 rounded-lg">
                        반려 사유: {r.rejectionReason}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
