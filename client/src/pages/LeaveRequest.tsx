import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarIcon, ChevronRight, Info } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const LEAVE_TYPES = [
  { value: "annual",  label: "연차",       desc: "1일 이상 사용" },
  { value: "half_am", label: "오전 반차",   desc: "0.5일 차감" },
  { value: "half_pm", label: "오후 반차",   desc: "0.5일 차감" },
  { value: "sick",    label: "병가",        desc: "의사 진단서 필요" },
  { value: "special", label: "특별 휴가",   desc: "경조사 등" },
  { value: "unpaid",  label: "무급 휴가",   desc: "잔여 연차 미차감" },
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
    onError: (err) => toast.error(err.message),
  });

  const isHalfDay = leaveType === "half_am" || leaveType === "half_pm";
  const remaining = Number(balance?.remaining ?? 0);

  const calcDays = () => {
    if (!dateRange?.from) return 0;
    if (isHalfDay) return 0.5;
    const end = dateRange.to ?? dateRange.from;
    let days = 0;
    const cur = new Date(dateRange.from);
    while (cur <= end) {
      const d = cur.getDay();
      if (d !== 0 && d !== 6) days++;
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  };

  const days = calcDays();
  const afterRemaining = remaining - days;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateRange?.from) return toast.error("날짜를 선택해주세요.");
    const startDate = format(dateRange.from, "yyyy-MM-dd");
    const endDate = isHalfDay
      ? startDate
      : format(dateRange.to ?? dateRange.from, "yyyy-MM-dd");
    submit.mutate({ leaveType, startDate, endDate, reason: reason || undefined });
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        {/* Balance summary */}
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

        {/* Form card */}
        <form onSubmit={handleSubmit} className="bg-card rounded-2xl shadow-card overflow-hidden">
          <div className="px-6 py-5 border-b border-border flex items-center gap-2">
            <CalendarIcon size={18} style={{ color: "var(--color-primary)" }} />
            <h2 className="font-semibold text-foreground">연차 신청서</h2>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Leave type */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">휴가 종류</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {LEAVE_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      setLeaveType(t.value);
                      if (t.value === "half_am" || t.value === "half_pm") {
                        setDateRange((d) => d?.from ? { from: d.from, to: d.from } : undefined);
                      }
                    }}
                    className={`flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all duration-150 ${
                      leaveType === t.value
                        ? "border-primary bg-secondary"
                        : "border-border hover:border-primary/40 hover:bg-muted/50"
                    }`}
                  >
                    <span className="text-sm font-semibold text-foreground">{t.label}</span>
                    <span className="text-xs text-muted-foreground mt-0.5">{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Date picker */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {isHalfDay ? "날짜 선택" : "날짜 범위 선택"}
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="w-full h-11 px-4 rounded-xl border border-border flex items-center justify-between text-sm hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
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
                    <CalendarIcon size={15} className="text-muted-foreground" />
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

            {/* Days preview */}
            {days > 0 && (
              <div
                className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background: "oklch(93% 0.06 264)" }}
              >
                <div className="flex items-center gap-2 text-sm" style={{ color: "var(--color-primary)" }}>
                  <Info size={14} />
                  <span>차감 예정: <strong>{days}일</strong></span>
                </div>
                <span className={`text-sm font-semibold ${afterRemaining < 0 ? "text-destructive" : "text-foreground"}`}>
                  신청 후 잔여: {afterRemaining}일
                </span>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                사유 <span className="text-muted-foreground font-normal">(선택)</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="휴가 사유를 입력해 주세요"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-muted/30 border-t border-border flex items-center justify-between">
            <button
              type="button"
              onClick={() => setLocation("/")}
              className="btn-ghost"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submit.isPending || !dateRange?.from || (afterRemaining < 0 && days > 0)}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submit.isPending ? "신청 중…" : "신청하기"}
              <ChevronRight size={15} />
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
