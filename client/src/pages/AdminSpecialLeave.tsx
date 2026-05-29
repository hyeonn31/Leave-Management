import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Gift, Check, AlertCircle } from "lucide-react";

type GrantResult = { userId: number; success: boolean };

export default function AdminSpecialLeave() {
  const currentYear = new Date().getFullYear();
  const { data: employees, isLoading } = trpc.employee.listAll.useQuery();

  const [fiscalYear, setFiscalYear] = useState(currentYear);
  const [workDate, setWorkDate] = useState("");
  const [days, setDays] = useState<number>(1);
  const [reason, setReason] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [grantResults, setGrantResults] = useState<GrantResult[] | null>(null);

  const utils = trpc.useUtils();
  const grantMutation = trpc.admin.grantSpecialLeave.useMutation({
    onSuccess: (data) => {
      setGrantResults(data.results);
      toast.success(`${data.granted}명에게 특별 연차가 부여되었습니다.`);
      setSelectedIds(new Set());
      // Invalidate all relevant caches so balances reflect immediately
      utils.admin.leaveOverview.invalidate();
      utils.admin.summary.invalidate();
      utils.leaveBalance.getMyBalance.invalidate();
    },
    onError: (err) => toast.error(`부여 실패: ${err.message}`),
  });

  const toggleSelect = (userId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleAll = () => {
    if (!employees) return;
    if (selectedIds.size === employees.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(employees.map((e) => e.user.id)));
    }
  };

  const handleGrant = () => {
    if (selectedIds.size === 0) {
      toast.error("대상 직원을 1명 이상 선택하세요.");
      return;
    }
    if (!workDate) {
      toast.error("출근 날짜를 입력하세요.");
      return;
    }
    if (!reason.trim()) {
      toast.error("사유를 입력하세요.");
      return;
    }
    setGrantResults(null);
    grantMutation.mutate({
      userIds: Array.from(selectedIds),
      fiscalYear,
      days,
      reason: reason.trim(),
      workDate,
    });
  };

  // Check if workDate is a weekend
  const isWeekend = (() => {
    if (!workDate) return null;
    const d = new Date(workDate);
    const day = d.getDay();
    return day === 0 || day === 6;
  })();

  const activeEmployees = employees ?? [];

  return (
    <div className="p-8 max-w-4xl animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-4 h-4 bg-red-accent" />
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">관리자</p>
        </div>
        <h1 className="text-4xl font-black tracking-tight">특별 연차 부여</h1>
        <p className="text-sm text-muted-foreground mt-2">
          주말 출근 등 특별 사유로 직원에게 보상 연차를 부여합니다.
        </p>
        <div className="its-rule mt-4" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* ── Left: Grant form ── */}
        <div className="space-y-5">
          <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground border-b border-border pb-2">
            부여 설정
          </h2>

          {/* Fiscal year */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest mb-1.5 text-muted-foreground">
              적용 연도
            </label>
            <div className="flex gap-2">
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <button
                  key={y}
                  onClick={() => setFiscalYear(y)}
                  className={`px-3 py-1.5 text-xs font-mono border transition-colors btn-press ${
                    fiscalYear === y
                      ? "bg-foreground text-background border-foreground"
                      : "border-border hover:border-foreground"
                  }`}
                >
                  {y}년
                </button>
              ))}
            </div>
          </div>

          {/* Work date */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest mb-1.5 text-muted-foreground">
              출근 날짜
            </label>
            <input
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              className="w-full h-10 border border-border px-3 text-sm focus:outline-none focus:border-foreground transition-colors"
            />
            {workDate && (
              <p
                className={`mt-1 text-[11px] flex items-center gap-1 ${
                  isWeekend ? "text-red-accent" : "text-amber-600"
                }`}
              >
                {isWeekend ? (
                  <>
                    <Check className="h-3 w-3" />
                    주말 출근 확인됨 ({new Date(workDate).toLocaleDateString("ko-KR", { weekday: "long" })})
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3 w-3" />
                    평일입니다. 주말 출근 보상이 맞는지 확인하세요.
                  </>
                )}
              </p>
            )}
          </div>

          {/* Days */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest mb-1.5 text-muted-foreground">
              부여 일수
            </label>
            <div className="flex items-center gap-3">
              {[0.5, 1, 1.5, 2].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-1.5 text-xs font-mono border transition-colors btn-press ${
                    days === d
                      ? "bg-foreground text-background border-foreground"
                      : "border-border hover:border-foreground"
                  }`}
                >
                  {d}일
                </button>
              ))}
              <input
                type="number"
                min={0.5}
                max={30}
                step={0.5}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="w-20 h-9 border border-border px-2 text-sm font-mono focus:outline-none focus:border-foreground transition-colors text-center"
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest mb-1.5 text-muted-foreground">
              사유
            </label>
            <input
              type="text"
              placeholder="예: 서버 긴급 점검, 행사 준비 등"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full h-10 border border-border px-3 text-sm focus:outline-none focus:border-foreground transition-colors"
            />
          </div>

          {/* Grant button */}
          <button
            onClick={handleGrant}
            disabled={grantMutation.isPending || selectedIds.size === 0}
            className="w-full h-11 bg-foreground text-background text-sm font-semibold hover:bg-red-accent transition-colors btn-press disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Gift className="h-4 w-4" />
            {grantMutation.isPending
              ? "부여 중..."
              : `선택한 ${selectedIds.size}명에게 특별 연차 ${days}일 부여`}
          </button>

          {/* Grant result */}
          {grantResults && (
            <div className="border border-border p-4 bg-muted/20">
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                부여 결과
              </p>
              <div className="space-y-1">
                {grantResults.map((r) => {
                  const emp = activeEmployees.find((e) => e.user.id === r.userId);
                  return (
                    <div key={r.userId} className="flex items-center gap-2 text-sm">
                      {r.success ? (
                        <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-red-accent shrink-0" />
                      )}
                      <span className={r.success ? "" : "text-red-accent"}>
                        {emp?.user.name ?? `ID ${r.userId}`}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {r.success ? "부여 완료" : "실패"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Employee selector ── */}
        <div>
          <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
            <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              대상 직원 선택
            </h2>
            <button
              onClick={toggleAll}
              className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            >
              {selectedIds.size === activeEmployees.length ? "전체 해제" : "전체 선택"}
            </button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-12 bg-muted animate-pulse" />)}
            </div>
          ) : activeEmployees.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">등록된 직원이 없습니다.</p>
          ) : (
            <div className="border border-border max-h-[480px] overflow-y-auto">
              {activeEmployees.map((row, i) => {
                const isSelected = selectedIds.has(row.user.id);
                return (
                  <label
                    key={row.user.id}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                      i < activeEmployees.length - 1 ? "border-b border-border" : ""
                    } ${isSelected ? "bg-foreground/5" : "hover:bg-muted/30"}`}
                  >
                    {/* Custom checkbox */}
                    <div
                      className={`w-4 h-4 border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? "bg-foreground border-foreground" : "border-border"
                      }`}
                    >
                      {isSelected && <Check className="h-2.5 w-2.5 text-background" />}
                    </div>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isSelected}
                      onChange={() => toggleSelect(row.user.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{row.user.name ?? "-"}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">
                        {row.employee?.department ?? "-"} · {row.employee?.position ?? "-"}
                      </p>
                    </div>
                    {row.employee?.employeeNumber && (
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                        {row.employee.employeeNumber}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}

          {selectedIds.size > 0 && (
            <p className="mt-2 text-xs font-mono text-muted-foreground">
              {selectedIds.size}명 선택됨
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
