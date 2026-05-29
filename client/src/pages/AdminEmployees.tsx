import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Edit2, Plus, X, ChevronDown } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

/** Convert a Date object or ISO string from DB to YYYY-MM-DD for <input type="date"> */
function toDateInputValue(val: unknown): string {
  if (!val) return "";
  const d = val instanceof Date ? val : new Date(String(val));
  if (isNaN(d.getTime())) return "";
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

const STATUS_LABELS: Record<string, string> = {
  active: "재직",
  resigned: "퇴직",
  on_leave: "휴직",
};
const STATUS_STYLES: Record<string, string> = {
  active: "text-green-700 bg-green-50 border-green-200",
  resigned: "text-gray-500 bg-gray-50 border-gray-200",
  on_leave: "text-amber-700 bg-amber-50 border-amber-200",
};

export default function AdminEmployees() {
  const { data: employees, isLoading } = trpc.employee.listAll.useQuery();
  const utils = trpc.useUtils();

  const [editTarget, setEditTarget] = useState<EmployeeRow | null>(null);
  const [form, setForm] = useState({
    employeeNumber: "",
    department: "",
    position: "",
    entryDate: "",
    status: "active" as "active" | "resigned" | "on_leave",
    role: "user" as "user" | "admin",
  });

  const openEdit = (row: EmployeeRow) => {
    setEditTarget(row);
    setForm({
      employeeNumber: row.employee?.employeeNumber ?? "",
      department: row.employee?.department ?? "",
      position: row.employee?.position ?? "",
      entryDate: toDateInputValue(row.employee?.entryDate),
      status: row.employee?.status ?? "active",
      role: row.user.role,
    });
  };

  const adminUpdate = trpc.employee.adminUpdate.useMutation({
    onSuccess: () => {
      toast.success("직원 정보가 수정되었습니다.");
      utils.employee.listAll.invalidate();
      setEditTarget(null);
    },
    onError: (err) => toast.error(err.message),
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
        <h1 className="text-4xl font-black tracking-tight">직원 관리</h1>
        <div className="its-rule mt-4" />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 bg-muted animate-pulse" />)}
        </div>
      ) : employees && employees.length > 0 ? (
        <div className="border border-border">
          {/* Table header */}
          <div className="grid grid-cols-12 bg-foreground text-background border-b border-foreground">
            <div className="col-span-2 px-4 py-3 text-xs font-mono uppercase tracking-widest">이름</div>
            <div className="col-span-2 px-4 py-3 text-xs font-mono uppercase tracking-widest">사번</div>
            <div className="col-span-2 px-4 py-3 text-xs font-mono uppercase tracking-widest">부서</div>
            <div className="col-span-2 px-4 py-3 text-xs font-mono uppercase tracking-widest">직급</div>
            <div className="col-span-2 px-4 py-3 text-xs font-mono uppercase tracking-widest">입사일</div>
            <div className="col-span-1 px-4 py-3 text-xs font-mono uppercase tracking-widest">상태</div>
            <div className="col-span-1 px-4 py-3" />
          </div>

          {employees.map((row, i) => (
            <div
              key={row.user.id}
              className={`grid grid-cols-12 items-center ${
                i < employees.length - 1 ? "border-b border-border" : ""
              } hover:bg-muted/30 transition-colors`}
            >
              <div className="col-span-2 px-4 py-3">
                <p className="text-sm font-semibold">{row.user.name ?? "-"}</p>
                <p className="text-[10px] font-mono text-muted-foreground">{row.user.email}</p>
              </div>
              <div className="col-span-2 px-4 py-3 text-sm font-mono text-muted-foreground">
                {row.employee?.employeeNumber ?? "-"}
              </div>
              <div className="col-span-2 px-4 py-3 text-sm text-muted-foreground">
                {row.employee?.department ?? "-"}
              </div>
              <div className="col-span-2 px-4 py-3 text-sm text-muted-foreground">
                {row.employee?.position ?? "-"}
              </div>
              <div className="col-span-2 px-4 py-3 text-sm font-mono text-muted-foreground">
                {toDateInputValue(row.employee?.entryDate) || "-"}
              </div>
              <div className="col-span-1 px-4 py-3">
                {row.employee ? (
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 border uppercase ${
                      STATUS_STYLES[row.employee.status]
                    }`}
                  >
                    {STATUS_LABELS[row.employee.status]}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-muted-foreground">미등록</span>
                )}
              </div>
              <div className="col-span-1 px-4 py-3 flex justify-end">
                <button
                  onClick={() => openEdit(row as EmployeeRow)}
                  className="p-1.5 hover:bg-muted transition-colors"
                  title="수정"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-border p-16 text-center">
          <p className="text-sm text-muted-foreground">등록된 직원이 없습니다.</p>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black tracking-tight">
              직원 정보 수정 — {editTarget?.user.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {[
              { label: "사번", key: "employeeNumber", placeholder: "EMP-001" },
              { label: "부서", key: "department", placeholder: "개발팀" },
              { label: "직급", key: "position", placeholder: "선임 개발자" },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-mono uppercase tracking-widest mb-1.5 text-muted-foreground">
                  {label}
                </label>
                <input
                  type="text"
                  value={form[key as keyof typeof form] as string}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full h-10 border border-border px-3 text-sm focus:outline-none focus:border-foreground transition-colors"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest mb-1.5 text-muted-foreground">
                입사일
              </label>
              <input
                type="date"
                value={form.entryDate}
                onChange={(e) => setForm((f) => ({ ...f, entryDate: e.target.value }))}
                className="w-full h-10 border border-border px-3 text-sm focus:outline-none focus:border-foreground transition-colors"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono uppercase tracking-widest mb-1.5 text-muted-foreground">
                  재직 상태
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as any }))}
                  className="w-full h-10 border border-border px-3 text-sm focus:outline-none focus:border-foreground transition-colors bg-background"
                >
                  <option value="active">재직</option>
                  <option value="resigned">퇴직</option>
                  <option value="on_leave">휴직</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono uppercase tracking-widest mb-1.5 text-muted-foreground">
                  역할
                </label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as any }))}
                  className="w-full h-10 border border-border px-3 text-sm focus:outline-none focus:border-foreground transition-colors bg-background"
                >
                  <option value="user">일반 직원</option>
                  <option value="admin">HR 관리자</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setEditTarget(null)}
              className="px-4 py-2 border border-border text-sm font-semibold hover:bg-muted transition-colors btn-press"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={adminUpdate.isPending}
              className="px-4 py-2 bg-foreground text-background text-sm font-semibold hover:bg-red-accent transition-colors btn-press disabled:opacity-40"
            >
              {adminUpdate.isPending ? "저장 중..." : "저장"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
