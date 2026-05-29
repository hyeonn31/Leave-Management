import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Edit2, RefreshCw, Check, Users } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import DashboardLayout from "@/components/DashboardLayout";

function toDateInputValue(val: unknown): string {
  if (!val) return "";
  const d = val instanceof Date ? val : new Date(String(val));
  if (isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

type EmployeeRow = {
  user: { id: number; name: string | null; email: string | null; role: "user" | "admin" };
  employee: {
    employeeNumber: string | null;
    department: string | null;
    position: string | null;
    entryDate: unknown;
    status: "active" | "resigned" | "on_leave";
  } | null;
};

const STATUS_LABELS: Record<string, string> = { active: "재직", resigned: "퇴직", on_leave: "휴직" };
type RecalcResult = { totalGranted: number; usedDays: number; remaining: number };

export default function AdminEmployees() {
  const { data: employees, isLoading } = trpc.employee.listAll.useQuery();
  const utils = trpc.useUtils();

  const [editTarget, setEditTarget] = useState<EmployeeRow | null>(null);
  const [form, setForm] = useState({
    employeeNumber: "", department: "", position: "", entryDate: "",
    status: "active" as "active" | "resigned" | "on_leave",
    role: "user" as "user" | "admin",
  });
  const [recalcYear, setRecalcYear] = useState<number>(new Date().getFullYear());
  const [recalcResult, setRecalcResult] = useState<RecalcResult | null>(null);
  const [savedEntryDate, setSavedEntryDate] = useState<string>("");

  const openEdit = (row: EmployeeRow) => {
    const entryDateStr = toDateInputValue(row.employee?.entryDate);
    setEditTarget(row);
    setRecalcResult(null);
    setSavedEntryDate(entryDateStr);
    setForm({
      employeeNumber: row.employee?.employeeNumber ?? "",
      department: row.employee?.department ?? "",
      position: row.employee?.position ?? "",
      entryDate: entryDateStr,
      status: row.employee?.status ?? "active",
      role: row.user.role,
    });
  };

  const closeDialog = () => { setEditTarget(null); setRecalcResult(null); setSavedEntryDate(""); };

  const adminUpdate = trpc.employee.adminUpdate.useMutation({
    onSuccess: () => {
      toast.success("직원 정보가 저장되었습니다.");
      utils.employee.listAll.invalidate();
      setSavedEntryDate(form.entryDate);
    },
    onError: (err) => toast.error(err.message),
  });

  const recalcLeave = trpc.employee.recalcLeave.useMutation({
    onSuccess: (data) => {
      setRecalcResult(data);
      utils.employee.listAll.invalidate();
      toast.success(`재계산 완료 — 부여 ${data.totalGranted}일 / 사용 ${data.usedDays}일 / 잔여 ${data.remaining}일`);
    },
    onError: (err) => toast.error(`재계산 실패: ${err.message}`),
  });

  const handleSave = () => {
    if (!editTarget) return;
    adminUpdate.mutate({
      userId: editTarget.user.id,
      employeeNumber: form.employeeNumber || undefined,
      department: form.department || undefined,
      position: form.position || undefined,
      entryDate: form.entryDate || undefined,
      status: form.status,
      role: form.role,
    });
  };

  const canRecalc = !!savedEntryDate;
  const entryDateChanged = form.entryDate !== savedEntryDate;

  return (
    <DashboardLayout>
      <div className="bg-card rounded-2xl shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Users size={16} style={{ color: "var(--color-primary)" }} />
          <h3 className="font-semibold text-foreground text-sm">직원 목록</h3>
          {employees && <span className="ml-auto text-xs text-muted-foreground">{employees.length}명</span>}
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : (employees ?? []).length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">등록된 직원이 없습니다</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">이름</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">사번</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">부서</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">직급</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">입사일</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">상태</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(employees ?? []).map((row) => (
                  <tr key={row.user.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-foreground">{row.user.name ?? "-"}</p>
                      <p className="text-xs text-muted-foreground">{row.user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {row.employee?.employeeNumber ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.employee?.department ?? "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.employee?.position ?? "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {toDateInputValue(row.employee?.entryDate) || "-"}
                    </td>
                    <td className="px-4 py-3">
                      {row.employee ? (
                        <span className={
                          row.employee.status === "active" ? "status-approved" :
                          row.employee.status === "resigned" ? "status-rejected" : "status-pending"
                        }>
                          {STATUS_LABELS[row.employee.status]}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">미등록</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => openEdit(row as EmployeeRow)}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                        title="수정"
                      >
                        <Edit2 size={14} className="text-muted-foreground" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-semibold text-foreground">
              직원 정보 수정 — {editTarget?.user.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {[
              { label: "사번", key: "employeeNumber", placeholder: "EMP-001" },
              { label: "부서", key: "department", placeholder: "개발팀" },
              { label: "직급", key: "position", placeholder: "선임 개발자" },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
                <input
                  type="text"
                  value={form[key as keyof typeof form] as string}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full h-10 rounded-xl border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                />
              </div>
            ))}

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">입사일</label>
              <input
                type="date"
                value={form.entryDate}
                onChange={(e) => { setRecalcResult(null); setForm((f) => ({ ...f, entryDate: e.target.value })); }}
                className="w-full h-10 rounded-xl border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
              {entryDateChanged && form.entryDate && (
                <p className="mt-1.5 text-xs text-amber-600">※ 입사일이 변경되었습니다. 먼저 저장 후 재계산하세요.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">재직 상태</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as any }))}
                  className="w-full h-10 rounded-xl border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-background"
                >
                  <option value="active">재직</option>
                  <option value="resigned">퇴직</option>
                  <option value="on_leave">휴직</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">역할</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as any }))}
                  className="w-full h-10 rounded-xl border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-background"
                >
                  <option value="user">일반 직원</option>
                  <option value="admin">HR 관리자</option>
                </select>
              </div>
            </div>

            {/* Recalc section */}
            <div className="border-t border-border pt-4 mt-2">
              <p className="text-xs font-medium text-muted-foreground mb-3">연차 잔여일수 즉시 재계산</p>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-muted-foreground mb-1.5">대상 연도</label>
                  <input
                    type="number" min={2020} max={2099}
                    value={recalcYear}
                    onChange={(e) => { setRecalcResult(null); setRecalcYear(Number(e.target.value)); }}
                    className="w-full h-10 rounded-xl border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => editTarget && recalcLeave.mutate({ userId: editTarget.user.id, fiscalYear: recalcYear })}
                  disabled={recalcLeave.isPending || !canRecalc || entryDateChanged}
                  className="btn-primary disabled:opacity-50 h-10"
                >
                  <RefreshCw size={13} className={recalcLeave.isPending ? "animate-spin" : ""} />
                  {recalcLeave.isPending ? "계산 중…" : "재계산"}
                </button>
              </div>
              {!canRecalc && (
                <p className="mt-1.5 text-xs text-muted-foreground">※ 입사일을 입력하고 저장한 후 재계산 버튼을 사용하세요.</p>
              )}
              {recalcResult && (
                <div className="mt-3 p-3 bg-muted/40 rounded-xl">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Check size={13} className="text-green-600" />
                    <p className="text-xs text-muted-foreground">{recalcYear}년 재계산 완료 — DB 반영됨</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: "총 부여일", value: recalcResult.totalGranted, highlight: false },
                      { label: "사용일", value: recalcResult.usedDays, highlight: false },
                      { label: "잔여일", value: recalcResult.remaining, highlight: true },
                    ].map(({ label, value, highlight }) => (
                      <div key={label}>
                        <p className="text-xl font-bold" style={highlight ? { color: "var(--color-primary)" } : {}}>{value}</p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <button onClick={closeDialog} className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
              닫기
            </button>
            <button onClick={handleSave} disabled={adminUpdate.isPending} className="btn-primary disabled:opacity-50">
              {adminUpdate.isPending ? "저장 중…" : "저장"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
