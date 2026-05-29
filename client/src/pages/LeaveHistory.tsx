import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: "연차",
  half_am: "오전 반차",
  half_pm: "오후 반차",
  sick: "병가",
  special: "특별 휴가",
  unpaid: "무급 휴가",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "대기",
  approved: "승인",
  rejected: "반려",
};

export default function LeaveHistory() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const years = [currentYear - 1, currentYear];

  const { data: requests, isLoading } = trpc.leaveRequest.myList.useQuery({
    fiscalYear: selectedYear,
  });
  const { data: balance } = trpc.leaveBalance.getMyBalance.useQuery({ fiscalYear: selectedYear });
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
    <div className="p-8 max-w-4xl animate-fade-in">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-4 h-4 bg-red-accent" />
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            연차 사용 내역
          </p>
        </div>
        <div className="flex items-end justify-between">
          <h1 className="text-4xl font-black tracking-tight">내 연차 이력</h1>
          {/* Year selector */}
          <div className="flex gap-0 border border-border">
            {years.map((y) => (
              <button
                key={y}
                onClick={() => setSelectedYear(y)}
                className={`px-4 py-2 text-sm font-mono transition-colors btn-press ${
                  selectedYear === y
                    ? "bg-foreground text-background"
                    : "hover:bg-muted"
                }`}
              >
                {y}년
              </button>
            ))}
          </div>
        </div>
        <div className="its-rule mt-4" />
      </div>

      {/* Balance summary */}
      {balance && (
        <div className="grid grid-cols-3 gap-0 border border-border mb-8">
          {[
            { label: "총 부여", value: `${Number(balance.totalGranted)}일` },
            { label: "사용", value: `${Number(balance.used)}일` },
            { label: "잔여", value: `${Number(balance.remaining)}일` },
          ].map((item, i) => (
            <div key={item.label} className={`p-4 ${i > 0 ? "border-l border-border" : ""}`}>
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
                {item.label}
              </p>
              <p className="text-xl font-black font-mono">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Request list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse" />
          ))}
        </div>
      ) : requests && requests.length > 0 ? (
        <div className="border border-border">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-0 border-b border-foreground bg-foreground text-background">
            <div className="col-span-2 px-4 py-3 text-xs font-mono uppercase tracking-widest">종류</div>
            <div className="col-span-4 px-4 py-3 text-xs font-mono uppercase tracking-widest">기간</div>
            <div className="col-span-1 px-4 py-3 text-xs font-mono uppercase tracking-widest text-right">일수</div>
            <div className="col-span-2 px-4 py-3 text-xs font-mono uppercase tracking-widest">상태</div>
            <div className="col-span-2 px-4 py-3 text-xs font-mono uppercase tracking-widest">신청일</div>
            <div className="col-span-1 px-4 py-3" />
          </div>
          {requests.map((req, i) => (
            <div
              key={req.id}
              className={`grid grid-cols-12 gap-0 items-center ${
                i < requests.length - 1 ? "border-b border-border" : ""
              } hover:bg-muted/50 transition-colors`}
            >
              <div className="col-span-2 px-4 py-3 text-sm font-medium">
                {LEAVE_TYPE_LABELS[req.leaveType]}
              </div>
              <div className="col-span-4 px-4 py-3 text-sm font-mono text-muted-foreground">
                {String(req.startDate)} ~ {String(req.endDate)}
              </div>
              <div className="col-span-1 px-4 py-3 text-sm font-mono text-right">
                {Number(req.totalDays)}일
              </div>
              <div className="col-span-2 px-4 py-3">
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 border uppercase ${STATUS_STYLES[req.status]}`}
                >
                  {STATUS_LABELS[req.status]}
                </span>
              </div>
              <div className="col-span-2 px-4 py-3 text-xs font-mono text-muted-foreground">
                {new Date(req.createdAt).toLocaleDateString("ko-KR")}
              </div>
              <div className="col-span-1 px-4 py-3 flex justify-end">
                {req.status === "pending" && (
                  <button
                    onClick={() => {
                      if (confirm("연차 신청을 취소하시겠습니까?")) {
                        cancel.mutate({ id: req.id });
                      }
                    }}
                    className="p-1.5 hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="취소"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {req.status === "rejected" && req.rejectionReason && (
                <div className="col-span-12 px-4 pb-3 -mt-1">
                  <p className="text-xs text-red-600 font-mono bg-red-50 px-3 py-1.5">
                    반려 사유: {req.rejectionReason}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-border p-16 text-center">
          <p className="text-sm text-muted-foreground">{selectedYear}년 연차 신청 내역이 없습니다.</p>
        </div>
      )}
    </div>
  );
}
