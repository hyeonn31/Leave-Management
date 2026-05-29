import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Edit2, RefreshCw, Check, Users, Wallet, UserPlus } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const currentYear = new Date().getFullYear();
  const { data: employees, isLoading } = trpc.employee.listAll.useQuery();
  const utils = trpc.useUtils();

  // ─── Employee edit dialog ────────────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState<EmployeeRow | null>(null);
  const [form, setForm] = useState({
    employeeNumber: "", department: "", position: "", entryDate: "",
    status: "active" as "active" | "resigned" | "on_leave",
    role: "user" as "user" | "admin",
  });
  const [recalcYear, setRecalcYear] = useState<number>(currentYear);
  const [recalcResult, setRecalcResult] = useState<RecalcResult | null>(null);
  const [savedEntryDate, setSavedEntryDate] = useState<string>("");

  // ─── Leave balance edit dialog ───────────────────────────────────────────────
  const [balanceTarget, setBalanceTarget] = useState<EmployeeRow | null>(null);
  const [balanceYear, setBalanceYear] = useState<number>(currentYear);
  const [balanceForm, setBalanceForm] = useState({ totalGranted: 0, used: 0, reason: "" });

  const { data: balanceData } = trpc.leaveBalance.getAllForYear.useQuery(
    { fiscalYear: balanceYear },
    { enabled: !!balanceTarget }
  );

  // ─── Register dialog ─────────────────────────────────────────────────────────
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [regForm, setRegForm] = useState({
    userId: 0, employeeNumber: "", department: "", position: "", entryDate: "",
  });
  const { data: allUsers } = trpc.employee.listAllUsers.useQuery(undefined, { enabled: showRegisterDialog });
  // Fetch team list for department dropdown
  const { data: teamList } = trpc.team.listAll.useQuery();

  const registeredUserIds = new Set((employees ?? []).map((e) => e.user.id));
  const unregisteredUsers = (allUsers ?? []).filter((u) => !registeredUserIds.has(u.id));

  // ─── Mutations ───────────────────────────────────────────────────────────────
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

  const setBalance = trpc.leaveBalance.setBalance.useMutation({
    onSuccess: (data) => {
      toast.success(`연차 수정 완료 — 잔여 ${data.remaining}일`);
      utils.leaveBalance.getAllForYear.invalidate();
      utils.employee.listAll.invalidate();
      setBalanceTarget(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const adminCreate = trpc.employee.adminCreate.useMutation({
    onSuccess: () => {
      toast.success("직원이 등록되었습니다.");
      utils.employee.listAll.invalidate();
      setShowRegisterDialog(false);
      setRegForm({ userId: 0, employeeNumber: "", department: "", position: "", entryDate: "" });
    },
    onError: (err) => toast.error(err.message),
  });

  // ─── Handlers ────────────────────────────────────────────────────────────────
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

  const openBalanceEdit = (row: EmployeeRow) => {
    setBalanceTarget(row);
    setBalanceYear(currentYear);
    setBalanceForm({ totalGranted: 0, used: 0, reason: "" });
  };

  // When balance data loads, pre-fill the form
  const currentBalance = balanceData?.find((b) => b.user.id === balanceTarget?.user.id);
  const prefilledBalance = currentBalance
    ? { totalGranted: Number(currentBalance.balance.totalGranted), used: Number(currentBalance.balance.used) }
    : null;

  const closeDialog = () => { setEditTarget(null); setRecalcResult(null); setSavedEntryDate(""); };

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

  const handleBalanceSave = () => {
    if (!balanceTarget) return;
    if (!balanceForm.reason.trim()) return toast.error("수정 사유를 입력해주세요.");
    setBalance.mutate({
      userId: balanceTarget.user.id,
      fiscalYear: balanceYear,
      totalGranted: balanceForm.totalGranted,
      used: balanceForm.used,
      reason: balanceForm.reason,
    });
  };

  const canRecalc = !!savedEntryDate;
  const entryDateChanged = form.entryDate !== savedEntryDate;

  return (
    <DashboardLayout>
      {/* Header with register button */}
      <div className="flex items-center justify-between mb-4">
        <div />
        <button
          onClick={() => setShowRegisterDialog(true)}
          className="btn-primary text-sm"
        >
          <UserPlus size={15} />
          직원 등록
        </button>
      </div>

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
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground">관리</th>
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
                      {row.user.role === "admin" ? <span className="text-muted-foreground/30">-</span> : (toDateInputValue(row.employee?.entryDate) || "-")}
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
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openBalanceEdit(row as EmployeeRow)}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                          title="연차 수정"
                        >
                          <Wallet size={14} className="text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => openEdit(row as EmployeeRow)}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                          title="정보 수정"
                        >
                          <Edit2 size={14} className="text-muted-foreground" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Employee Info Edit Dialog ─────────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-semibold text-foreground">
              직원 정보 수정 — {editTarget?.user.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 사번 */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">사번</label>
              <input
                type="text"
                value={form.employeeNumber}
                onChange={(e) => setForm((f) => ({ ...f, employeeNumber: e.target.value }))}
                placeholder="EMP-001"
                className="w-full h-10 rounded-xl border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>
            {/* 부서 — 팀 목록 드롭다운 */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">부서 (팀)</label>
              <Select
                value={form.department || "__none__"}
                onValueChange={(v) => setForm((f) => ({ ...f, department: v === "__none__" ? "" : v }))}
              >
                <SelectTrigger className="w-full h-10 rounded-xl">
                  <SelectValue placeholder="팀을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">선택 안함</SelectItem>
                  {(teamList ?? []).map((t) => (
                    <SelectItem key={t.team.id} value={t.team.name}>
                      {t.team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(teamList ?? []).length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">팀 관리에서 팀을 먼저 생성해주세요.</p>
              )}
            </div>
            {/* 직급 */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">직급</label>
              <input
                type="text"
                value={form.position}
                onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                placeholder="선임 개발자"
                className="w-full h-10 rounded-xl border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>

            {form.role !== "admin" && (
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
            )}

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

      {/* ─── Leave Balance Direct Edit Dialog ─────────────────────────────── */}
      <Dialog open={!!balanceTarget} onOpenChange={(open) => { if (!open) setBalanceTarget(null); }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-semibold text-foreground flex items-center gap-2">
              <Wallet size={16} style={{ color: "var(--color-primary)" }} />
              연차 직접 수정 — {balanceTarget?.user.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Year selector */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">대상 연도</label>
              <div className="flex items-center gap-2">
                {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setBalanceYear(y)}
                    className={`pill-tab ${balanceYear === y ? "active" : ""}`}
                  >
                    {y}년
                  </button>
                ))}
              </div>
            </div>

            {/* Current balance info */}
            {prefilledBalance && (
              <div className="p-3 bg-muted/40 rounded-xl">
                <p className="text-xs text-muted-foreground mb-2">현재 {balanceYear}년 연차 현황</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: "총 부여", value: prefilledBalance.totalGranted },
                    { label: "사용", value: prefilledBalance.used },
                    { label: "잔여", value: prefilledBalance.totalGranted - prefilledBalance.used },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-lg font-bold text-foreground">{value}</p>
                      <p className="text-xs text-muted-foreground">{label}일</p>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setBalanceForm((f) => ({ ...f, totalGranted: prefilledBalance.totalGranted, used: prefilledBalance.used }))}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  현재 값으로 채우기
                </button>
              </div>
            )}
            {!prefilledBalance && balanceData && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-xs text-amber-700">{balanceYear}년 연차 데이터가 없습니다. 새로 생성됩니다.</p>
              </div>
            )}

            {/* New values */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  총 부여일수 <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={365}
                  step={0.5}
                  value={balanceForm.totalGranted}
                  onChange={(e) => setBalanceForm((f) => ({ ...f, totalGranted: Number(e.target.value) }))}
                  className="w-full h-10 rounded-xl border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  사용일수 <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={365}
                  step={0.5}
                  value={balanceForm.used}
                  onChange={(e) => setBalanceForm((f) => ({ ...f, used: Number(e.target.value) }))}
                  className="w-full h-10 rounded-xl border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors font-mono"
                />
              </div>
            </div>

            {/* Calculated remaining */}
            <div
              className="flex items-center justify-between px-4 py-3 rounded-xl"
              style={{ background: "oklch(93% 0.06 264)" }}
            >
              <span className="text-sm text-muted-foreground">수정 후 잔여일수</span>
              <span
                className="text-xl font-bold"
                style={{
                  color: Math.max(0, balanceForm.totalGranted - balanceForm.used) === 0
                    ? "oklch(55% 0.22 25)"
                    : "var(--color-primary)",
                }}
              >
                {Math.max(0, balanceForm.totalGranted - balanceForm.used)}일
              </span>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                수정 사유 <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={balanceForm.reason}
                onChange={(e) => setBalanceForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="예: 입사일 오류 정정, 특별 부여 등"
                className="w-full h-10 rounded-xl border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <button
              onClick={() => setBalanceTarget(null)}
              className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleBalanceSave}
              disabled={setBalance.isPending || !balanceForm.reason.trim()}
              className="btn-primary disabled:opacity-50"
            >
              {setBalance.isPending ? "저장 중…" : "저장"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Register Dialog ──────────────────────────────────────────────── */}
      <Dialog open={showRegisterDialog} onOpenChange={(open) => { if (!open) setShowRegisterDialog(false); }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-semibold text-foreground flex items-center gap-2">
              <UserPlus size={16} style={{ color: "var(--color-primary)" }} />
              신규 직원 등록
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                사용자 선택 <span className="text-destructive">*</span>
              </label>
              <select
                value={regForm.userId}
                onChange={(e) => setRegForm((f) => ({ ...f, userId: Number(e.target.value) }))}
                className="w-full h-10 rounded-xl border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-background"
              >
                <option value={0}>-- 사용자를 선택하세요 --</option>
                {unregisteredUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name ?? u.email} ({u.email})
                  </option>
                ))}
              </select>
              {unregisteredUsers.length === 0 && allUsers && (
                <p className="mt-1.5 text-xs text-muted-foreground">미등록 사용자가 없습니다.</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">사번</label>
              <input
                type="text"
                value={regForm.employeeNumber}
                onChange={(e) => setRegForm((f) => ({ ...f, employeeNumber: e.target.value }))}
                placeholder="EMP-001"
                className="w-full h-10 rounded-xl border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">부서 (팀)</label>
              <Select
                value={regForm.department || "__none__"}
                onValueChange={(v) => setRegForm((f) => ({ ...f, department: v === "__none__" ? "" : v }))}
              >
                <SelectTrigger className="w-full h-10 rounded-xl">
                  <SelectValue placeholder="팀을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">선택 안함</SelectItem>
                  {(teamList ?? []).map((t) => (
                    <SelectItem key={t.team.id} value={t.team.name}>
                      {t.team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(teamList ?? []).length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">팀 관리에서 팀을 먼저 생성해주세요.</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">직급</label>
              <input
                type="text"
                value={regForm.position}
                onChange={(e) => setRegForm((f) => ({ ...f, position: e.target.value }))}
                placeholder="선임 개발자"
                className="w-full h-10 rounded-xl border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                입사일 <span className="text-muted-foreground font-normal">(연차 자동 계산에 사용)</span>
              </label>
              <input
                type="date"
                value={regForm.entryDate}
                onChange={(e) => setRegForm((f) => ({ ...f, entryDate: e.target.value }))}
                className="w-full h-10 rounded-xl border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <button
              onClick={() => setShowRegisterDialog(false)}
              className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              취소
            </button>
            <button
              onClick={() => {
                if (!regForm.userId) return toast.error("사용자를 선택해주세요.");
                adminCreate.mutate({
                  userId: regForm.userId,
                  employeeNumber: regForm.employeeNumber || undefined,
                  department: regForm.department || undefined,
                  position: regForm.position || undefined,
                  entryDate: regForm.entryDate || undefined,
                });
              }}
              disabled={adminCreate.isPending || !regForm.userId}
              className="btn-primary disabled:opacity-50"
            >
              {adminCreate.isPending ? "등록 중…" : "등록하기"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
