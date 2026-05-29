import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarIcon, ChevronDown } from "lucide-react";
import type { DateRange } from "react-day-picker";

const LEAVE_TYPES = [
  { value: "annual", label: "연차", desc: "1일 차감" },
  { value: "half_am", label: "오전 반차", desc: "0.5일 차감" },
  { value: "half_pm", label: "오후 반차", desc: "0.5일 차감" },
  { value: "sick", label: "병가", desc: "연차 미차감" },
  { value: "special", label: "특별 휴가", desc: "연차 미차감" },
  { value: "unpaid", label: "무급 휴가", desc: "연차 미차감" },
] as const;

type LeaveTypeValue = (typeof LEAVE_TYPES)[number]["value"];

export default function LeaveRequest() {
  const [, setLocation] = useLocation();
  const currentYear = new Date().getFullYear();

  const [leaveType, setLeaveType] = useState<LeaveTypeValue>("annual");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [reason, setReason] = useState("");

  const { data: balance } = trpc.leaveBalance.getMyBalance.useQuery({ fiscalYear: currentYear });
  const utils = trpc.useUtils();

  const submit = trpc.leaveRequest.submit.useMutation({
    onSuccess: () => {
      toast.success("연차 신청이 접수되었습니다.");
      utils.leaveRequest.myList.invalidate();
      utils.leaveBalance.getMyBalance.invalidate();
      setLocation("/leave/history");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const isHalfDay = leaveType === "half_am" || leaveType === "half_pm";
  const remaining = Number(balance?.remaining ?? 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateRange?.from) {
      toast.error("날짜를 선택해주세요.");
      return;
    }
    const startDate = format(dateRange.from, "yyyy-MM-dd");
    const endDate = isHalfDay
      ? startDate
      : format(dateRange.to ?? dateRange.from, "yyyy-MM-dd");

    submit.mutate({ leaveType, startDate, endDate, reason: reason || undefined });
  };

  return (
    <div className="p-8 max-w-2xl animate-fade-in">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-4 h-4 bg-red-accent" />
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            연차 신청
          </p>
        </div>
        <h1 className="text-4xl font-black tracking-tight">휴가 신청서</h1>
        <div className="its-rule mt-4" />
      </div>

      {/* Balance info */}
      <div className="border border-border p-4 mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
            {currentYear}년 잔여 연차
          </p>
          <p className="text-2xl font-black font-mono">{remaining}일</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-mono text-muted-foreground">
            총 {Number(balance?.totalGranted ?? 0)}일 중 {Number(balance?.used ?? 0)}일 사용
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Leave type */}
        <div>
          <label className="block text-xs font-mono uppercase tracking-widest mb-3">
            휴가 종류
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {LEAVE_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setLeaveType(t.value)}
                className={`p-3 border text-left transition-colors btn-press ${
                  leaveType === t.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:border-foreground"
                }`}
              >
                <p className="text-sm font-semibold">{t.label}</p>
                <p
                  className={`text-[10px] font-mono mt-0.5 ${
                    leaveType === t.value ? "text-white/60" : "text-muted-foreground"
                  }`}
                >
                  {t.desc}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Date selection */}
        <div>
          <label className="block text-xs font-mono uppercase tracking-widest mb-3">
            {isHalfDay ? "날짜 선택" : "날짜 범위 선택"}
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="w-full h-12 border border-border px-4 flex items-center justify-between text-sm hover:border-foreground transition-colors"
              >
                <span className={dateRange?.from ? "text-foreground" : "text-muted-foreground"}>
                  {dateRange?.from
                    ? isHalfDay
                      ? format(dateRange.from, "yyyy년 MM월 dd일 (eee)", { locale: ko })
                      : dateRange.to
                      ? `${format(dateRange.from, "yyyy.MM.dd")} ~ ${format(dateRange.to, "yyyy.MM.dd")}`
                      : format(dateRange.from, "yyyy년 MM월 dd일 (eee)", { locale: ko })
                    : "날짜를 선택하세요"}
                </span>
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              {isHalfDay ? (
                <Calendar
                  mode="single"
                  selected={dateRange?.from}
                  onSelect={(d) => setDateRange(d ? { from: d, to: d } : undefined)}
                  disabled={(d) => d < new Date()}
                  locale={ko}
                />
              ) : (
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  disabled={(d) => d < new Date()}
                  numberOfMonths={2}
                  locale={ko}
                />
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-xs font-mono uppercase tracking-widest mb-3">
            사유 <span className="text-muted-foreground">(선택)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="휴가 사유를 입력하세요..."
            rows={3}
            className="w-full border border-border px-4 py-3 text-sm resize-none focus:outline-none focus:border-foreground transition-colors font-sans"
          />
        </div>

        {/* Submit */}
        <div className="pt-2">
          <div className="its-rule mb-6" />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setLocation("/")}
              className="flex-1 h-12 border border-border text-sm font-semibold uppercase tracking-widest hover:bg-muted transition-colors btn-press"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submit.isPending || !dateRange?.from}
              className="flex-1 h-12 bg-foreground text-background text-sm font-semibold uppercase tracking-widest hover:bg-red-accent transition-colors btn-press disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submit.isPending ? "신청 중..." : "신청하기"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
