import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Check, X, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: "연차",
  half_am: "오전 반차",
  half_pm: "오후 반차",
  sick: "병가",
  special: "특별 휴가",
  unpaid: "무급 휴가",
};

const STATUS_FILTER_OPTIONS = [
  { value: undefined, label: "전체" },
  { value: "pending", label: "대기" },
  { value: "approved", label: "승인" },
  { value: "rejected", label: "반려" },
] as const;

type StatusFilter = "pending" | "approved" | "rejected" | undefined;

export default function AdminRequests() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: requests, isLoading } = trpc.leaveRequest.adminList.useQuery({
    status: statusFilter,
  });
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
    if (confirm("승인하시겠습니까?")) {
      decide.mutate({ id, decision: "approved" });
    }
  };

  const handleRejectOpen = (id: number) => {
    setSelectedId(id);
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = () => {
    if (!selectedId) return;
    decide.mutate({ id: selectedId, decision: "rejected", rejectionReason });
  };

  return (
    <div className="p-8 max-w-6xl animate-fade-in">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-4 h-4 bg-red-accent" />
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            관리자
          </p>
        </div>
        <div className="flex items-end justify-between">
          <h1 className="text-4xl font-black tracking-tight">연차 신청 관리</h1>
          {/* Status filter */}
          <div className="flex gap-0 border border-border">
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-4 py-2 text-sm font-mono transition-colors btn-press ${
                  statusFilter === opt.value
                    ? "bg-foreground text-background"
                    : "hover:bg-muted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="its-rule mt-4" />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted animate-pulse" />)}
        </div>
      ) : requests && requests.length > 0 ? (
        <div className="border border-border">
          {/* Table header */}
          <div className="grid grid-cols-12 bg-foreground text-background border-b border-foreground">
            <div className="col-span-2 px-4 py-3 text-xs font-mono uppercase tracking-widest">직원</div>
            <div className="col-span-2 px-4 py-3 text-xs font-mono uppercase tracking-widest">부서</div>
            <div className="col-span-2 px-4 py-3 text-xs font-mono uppercase tracking-widest">종류</div>
            <div className="col-span-3 px-4 py-3 text-xs font-mono uppercase tracking-widest">기간</div>
            <div className="col-span-1 px-4 py-3 text-xs font-mono uppercase tracking-widest text-right">일수</div>
            <div className="col-span-2 px-4 py-3 text-xs font-mono uppercase tracking-widest text-right">처리</div>
          </div>

          {requests.map((item, i) => {
            const req = item.request;
            const isPending = req.status === "pending";
            return (
              <div
                key={req.id}
                className={`grid grid-cols-12 items-center ${
                  i < requests.length - 1 ? "border-b border-border" : ""
                } hover:bg-muted/30 transition-colors`}
              >
                <div className="col-span-2 px-4 py-3">
                  <p className="text-sm font-semibold">{item.user.name ?? "-"}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{item.user.email}</p>
                </div>
                <div className="col-span-2 px-4 py-3 text-sm text-muted-foreground">
                  {item.employee?.department ?? "-"}
                </div>
                <div className="col-span-2 px-4 py-3">
                  <span className="text-sm">{LEAVE_TYPE_LABELS[req.leaveType]}</span>
                </div>
                <div className="col-span-3 px-4 py-3 text-sm font-mono text-muted-foreground">
                  {String(req.startDate)} ~ {String(req.endDate)}
                </div>
                <div className="col-span-1 px-4 py-3 text-sm font-mono text-right">
                  {Number(req.totalDays)}일
                </div>
                <div className="col-span-2 px-4 py-3 flex items-center justify-end gap-2">
                  {isPending ? (
                    <>
                      <button
                        onClick={() => handleApprove(req.id)}
                        disabled={decide.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 bg-foreground text-background text-xs font-mono uppercase hover:bg-green-700 transition-colors btn-press disabled:opacity-40"
                      >
                        <Check className="h-3 w-3" />
                        승인
                      </button>
                      <button
                        onClick={() => handleRejectOpen(req.id)}
                        disabled={decide.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 border border-red-accent text-red-accent text-xs font-mono uppercase hover:bg-red-accent hover:text-white transition-colors btn-press disabled:opacity-40"
                      >
                        <X className="h-3 w-3" />
                        반려
                      </button>
                    </>
                  ) : (
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 uppercase border ${
                        req.status === "approved"
                          ? "border-green-300 text-green-700 bg-green-50"
                          : "border-red-300 text-red-700 bg-red-50"
                      }`}
                    >
                      {req.status === "approved" ? "승인됨" : "반려됨"}
                    </span>
                  )}
                </div>
                {req.reason && (
                  <div className="col-span-12 px-4 pb-3 -mt-1">
                    <p className="text-xs text-muted-foreground font-mono bg-muted px-3 py-1.5">
                      사유: {req.reason}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border border-border p-16 text-center">
          <p className="text-sm text-muted-foreground">
            {statusFilter === "pending" ? "대기 중인 신청이 없습니다." : "신청 내역이 없습니다."}
          </p>
        </div>
      )}

      {/* Reject dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black tracking-tight">반려 사유 입력</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="block text-xs font-mono uppercase tracking-widest mb-2 text-muted-foreground">
              반려 사유
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="반려 사유를 입력하세요..."
              rows={4}
              className="w-full border border-border px-4 py-3 text-sm resize-none focus:outline-none focus:border-foreground transition-colors"
            />
          </div>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setRejectDialogOpen(false)}
              className="px-4 py-2 border border-border text-sm font-semibold hover:bg-muted transition-colors btn-press"
            >
              취소
            </button>
            <button
              onClick={handleRejectConfirm}
              disabled={decide.isPending}
              className="px-4 py-2 bg-red-accent text-white text-sm font-semibold hover:bg-red-700 transition-colors btn-press disabled:opacity-40"
            >
              {decide.isPending ? "처리 중..." : "반려 확정"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
