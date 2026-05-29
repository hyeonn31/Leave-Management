import DashboardLayout from "@/components/DashboardLayout";
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
      utils.admin.leaveOverview.invalidate();
      utils.admin.summary.invalidate();
      utils.leaveBalance.getMyBalance.invalidate();
    },
    onError: (err) => toast.error(`부여 실패: ${err.message}`),
  });

  const toggleSelect = (userId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  };

  const toggleAll = () => {
    if (!employees) return;
    if (selectedIds.size === employees.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(employees.map((e) => e.user.id)));
  };

  const handleGrant = () => {
    if (selectedIds.size === 0) { toast.error("대상 직원을 1명 이상 선택하세요."); return; }
    if (!workDate) { toast.error("출근 날짜를 입력하세요."); return; }
    if (!reason.trim()) { toast.error("사유를 입력하세요."); return; }
    setGrantResults(null);
    grantMutation.mutate({ userIds: Array.from(selectedIds), fiscalYear, days, reason: reason.trim(), workDate });
  };

  const isWeekend = (() => {
    if (!workDate) return null;
    const d = new Date(workDate);
    return d.getDay() === 0 || d.getDay() === 6;
  })();

  const activeEmployees = employees ?? [];

  return (
    <DashboardLayout>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left: Grant form */}
        <div className="bg-card rounded-2xl shadow-card p-5 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Gift size={16} style={{ color: "var(--color-primary)" }} />
            <h3 className="font-semibold text-foreground text-sm">부여 설정</h3>
          </div>

          {/* Fiscal year */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">적용 연도</label>
            <div className="flex gap-2">
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <button key={y} onClick={() => setFiscalYear(y)} className={`pill-tab ${fiscalYear === y ? "active" : ""}`}>
                  {y}년
                </button>
              ))}
            </div>
          </div>

          {/* Work date */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">출근 날짜</label>
            <input
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              className="w-full h-10 rounded-xl border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
            {workDate && (
              <p className={`mt-1.5 text-xs flex items-center gap-1 ${isWeekend ? "text-green-600" : "text-amber-600"}`}>
                {isWeekend ? (
                  <><Check size={12} /> 주말 출근 확인됨 ({new Date(workDate).toLocaleDateString("ko-KR", { weekday: "long" })})</>
                ) : (
                  <><AlertCircle size={12} /> 평일입니다. 주말 출근 보상이 맞는지 확인하세요.</>
                )}
              </p>
            )}
          </div>

          {/* Days */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">부여 일수</label>
            <div className="flex items-center gap-2 flex-wrap">
              {[0.5, 1, 1.5, 2].map((d) => (
                <button key={d} onClick={() => setDays(d)} className={`pill-tab ${days === d ? "active" : ""}`}>
                  {d}일
                </button>
              ))}
              <input
                type="number"
                min={0.5} max={30} step={0.5}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="w-20 h-8 rounded-xl border border-border px-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">사유</label>
            <input
              type="text"
              placeholder="예: 서버 긴급 점검, 행사 준비 등"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full h-10 rounded-xl border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
          </div>

          {/* Grant button */}
          <button
            onClick={handleGrant}
            disabled={grantMutation.isPending || selectedIds.size === 0}
            className="btn-primary w-full justify-center disabled:opacity-50"
          >
            <Gift size={14} />
            {grantMutation.isPending ? "부여 중…" : `선택한 ${selectedIds.size}명에게 ${days}일 부여`}
          </button>

          {/* Grant result */}
          {grantResults && (
            <div className="bg-muted/40 rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">부여 결과</p>
              <div className="space-y-1.5">
                {grantResults.map((r) => {
                  const emp = activeEmployees.find((e) => e.user.id === r.userId);
                  return (
                    <div key={r.userId} className="flex items-center gap-2 text-sm">
                      {r.success
                        ? <Check size={13} className="text-green-600 shrink-0" />
                        : <AlertCircle size={13} style={{ color: "var(--color-primary)" }} className="shrink-0" />}
                      <span className={r.success ? "text-foreground" : "text-red-600"}>
                        {emp?.user.name ?? `ID ${r.userId}`}
                      </span>
                      <span className="text-xs text-muted-foreground">{r.success ? "부여 완료" : "실패"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Employee selector */}
        <div className="bg-card rounded-2xl shadow-card p-5">
          <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
            <h3 className="font-semibold text-foreground text-sm">대상 직원 선택</h3>
            <button onClick={toggleAll} className="text-xs text-primary hover:underline transition-colors">
              {selectedIds.size === activeEmployees.length ? "전체 해제" : "전체 선택"}
            </button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />)}
            </div>
          ) : activeEmployees.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">등록된 직원이 없습니다</p>
          ) : (
            <div className="space-y-1 max-h-[440px] overflow-y-auto pr-1">
              {activeEmployees.map((row) => {
                const isSelected = selectedIds.has(row.user.id);
                return (
                  <label
                    key={row.user.id}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-colors ${
                      isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50 border border-transparent"
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors border-2"
                      style={isSelected ? { background: "var(--color-primary)", borderColor: "var(--color-primary)" } : { borderColor: "oklch(80% 0.02 264)" }}
                    >
                      {isSelected && <Check size={10} className="text-white" />}
                    </div>
                    <input type="checkbox" className="sr-only" checked={isSelected} onChange={() => toggleSelect(row.user.id)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{row.user.name ?? "-"}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.employee?.department ?? "-"} · {row.employee?.position ?? "-"}
                      </p>
                    </div>
                    {row.employee?.employeeNumber && (
                      <span className="text-xs text-muted-foreground shrink-0">{row.employee.employeeNumber}</span>
                    )}
                  </label>
                );
              })}
            </div>
          )}

          {selectedIds.size > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">{selectedIds.size}명 선택됨</p>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
