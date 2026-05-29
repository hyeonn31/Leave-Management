import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Check, X, CalendarDays, AlertCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: "연차", half_am: "오전 반차", half_pm: "오후 반차",
  sick: "병가", special: "특별 휴가", unpaid: "무급 휴가",
};

const STATUS_FILTER_OPTIONS = [
  { value: undefined, label: "전체" },
  { value: "pending",  label: "대기" },
  { value: "approved", label: "승인" },
  { value: "rejected", label: "반려" },
] as const;

type StatusFilter = "pending" | "approved" | "rejected" | undefined;

export default function AdminRequests() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: requests, isLoading } = trpc.leaveRequest.adminList.useQuery({ status: statusFilter });
  const utils = trpc.useUtils();

  const decide = trpc.leaveRequest.decide.useMutation({
    onSuccess: (_, vars) => {
      toast.success(vars.decision === "approved" ? "승인되었습니다." : "반려되었습니다.");
      utils.leaveRequest.adminList.invalidate();
      utils.admin.summary.invalidate();
      setRejectDialogOpen(false);
      setRejectionReason("");
      setSelectedId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleApprove = (id: number) => {
    if (confirm("승인하시겠습니까?")) decide.mutate({ id, decision: "approved" });
  };

  return (
    <DashboardLayout>
      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-6">
        {STATUS_FILTER_OPTIONS.map((opt) => (
          <button
            key={String(opt.value)}
            onClick={() => setStatusFilter(opt.value)}
            className={`pill-tab ${statusFilter === opt.value ? "active" : ""}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-card rounded-2xl shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">연차 신청 목록</h3>
          <p className="text-xs text-muted-foreground mt-0.5">총 {(requests ?? []).length}건</p>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : (requests ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle size={36} className="text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {statusFilter === "pending" ? "대기 중인 신청이 없습니다" : "신청 내역이 없습니다"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {(requests as any[]).map((item) => {
              const req = item.request;
              const isPending = req.status === "pending";
              return (
                <div key={req.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "oklch(93% 0.06 264)" }}
                  >
                    <CalendarDays size={16} style={{ color: "var(--color-primary)" }} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-foreground">{item.user.name ?? "-"}</p>
                      <span className="text-xs text-muted-foreground">{item.employee?.department ?? ""}</span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {LEAVE_TYPE_LABELS[req.leaveType] ?? req.leaveType}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {String(req.startDate).slice(0, 10)} ~ {String(req.endDate).slice(0, 10)} · {req.totalDays}일
                      {req.reason && ` · ${req.reason}`}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isPending ? (
                      <>
                        <button
                          onClick={() => handleApprove(req.id)}
                          disabled={decide.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40"
                          style={{ background: "oklch(93% 0.06 145)", color: "oklch(40% 0.18 145)" }}
                        >
                          <Check size={12} /> 승인
                        </button>
                        <button
                          onClick={() => { setSelectedId(req.id); setRejectDialogOpen(true); }}
                          disabled={decide.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40"
                          style={{ background: "oklch(95% 0.04 25)", color: "oklch(45% 0.22 25)" }}
                        >
                          <X size={12} /> 반려
                        </button>
                      </>
                    ) : (
                      <span className={req.status === "approved" ? "status-approved" : "status-rejected"}>
                        {req.status === "approved" ? "승인됨" : "반려됨"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reject dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-semibold">반려 사유 입력</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <label className="block text-sm font-medium text-foreground mb-1.5">반려 사유</label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="반려 사유를 입력하세요..."
              rows={4}
              className="w-full px-3 py-2.5 rounded-xl border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
          </div>
          <DialogFooter className="gap-2">
            <button onClick={() => setRejectDialogOpen(false)} className="btn-ghost">취소</button>
            <button
              onClick={() => { if (selectedId) decide.mutate({ id: selectedId, decision: "rejected", rejectionReason }); }}
              disabled={decide.isPending}
              className="btn-danger disabled:opacity-50"
            >
              {decide.isPending ? "처리 중…" : "반려 확정"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
