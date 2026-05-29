import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { User, Building2, Briefcase, Calendar, Hash, Pencil, X, Save, ShieldCheck } from "lucide-react";

function toDateInputValue(val: unknown): string {
  if (!val) return "";
  const d = val instanceof Date ? val : new Date(String(val));
  if (isNaN(d.getTime())) return "";
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function Profile() {
  const { user } = useAuth();
  const { data: profile, isLoading } = trpc.employee.getMyProfile.useQuery();
  const utils = trpc.useUtils();

  const [form, setForm] = useState({ employeeNumber: "", department: "", position: "", entryDate: "" });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (profile?.employee) {
      setForm({
        employeeNumber: profile.employee.employeeNumber ?? "",
        department: profile.employee.department ?? "",
        position: profile.employee.position ?? "",
        entryDate: toDateInputValue(profile.employee.entryDate),
      });
    }
  }, [profile]);

  const update = trpc.employee.updateMyProfile.useMutation({
    onSuccess: () => {
      toast.success("프로필이 저장되었습니다.");
      utils.employee.getMyProfile.invalidate();
      utils.leaveBalance.getMyBalance.invalidate();
      setEditing(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate({
      employeeNumber: form.employeeNumber || undefined,
      department: form.department || undefined,
      position: form.position || undefined,
      entryDate: form.entryDate || undefined,
    });
  };

  const cancelEdit = () => {
    setEditing(false);
    if (profile?.employee) {
      setForm({
        employeeNumber: profile.employee.employeeNumber ?? "",
        department: profile.employee.department ?? "",
        position: profile.employee.position ?? "",
        entryDate: toDateInputValue(profile.employee.entryDate),
      });
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-xl mx-auto space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />)}
        </div>
      </DashboardLayout>
    );
  }

  const hasProfile = !!profile?.employee?.entryDate;

  return (
    <DashboardLayout>
      <div className="max-w-xl mx-auto space-y-4">
        {/* Account card */}
        <div className="bg-card rounded-2xl shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <ShieldCheck size={16} style={{ color: "var(--color-primary)" }} />
            <h3 className="font-semibold text-foreground text-sm">계정 정보</h3>
          </div>
          <div className="px-5 py-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">이름</p>
              <p className="font-semibold text-foreground">{user?.name ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">이메일</p>
              <p className="font-medium text-sm text-foreground">{user?.email ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">역할</p>
              <span
                className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
                style={
                  user?.role === "admin"
                    ? { background: "oklch(93% 0.06 264)", color: "var(--color-primary)" }
                    : { background: "oklch(93% 0.02 264)", color: "oklch(50% 0.02 264)" }
                }
              >
                {user?.role === "admin" ? "HR 관리자" : "일반 직원"}
              </span>
            </div>
          </div>
        </div>

        {/* Employee profile card */}
        {!hasProfile && !editing ? (
          <div className="bg-card rounded-2xl shadow-card p-8 flex flex-col items-center text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "oklch(93% 0.06 264)" }}
            >
              <User size={24} style={{ color: "var(--color-primary)" }} />
            </div>
            <p className="font-semibold text-foreground mb-1">직원 정보가 없습니다</p>
            <p className="text-sm text-muted-foreground mb-5">입사일을 등록해야 연차가 자동으로 산정됩니다.</p>
            <button onClick={() => setEditing(true)} className="btn-primary">
              정보 등록하기
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-card rounded-2xl shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User size={16} style={{ color: "var(--color-primary)" }} />
                <h3 className="font-semibold text-foreground text-sm">직원 정보</h3>
              </div>
              {!editing && (
                <button type="button" onClick={() => setEditing(true)} className="btn-ghost text-xs">
                  <Pencil size={13} /> 수정
                </button>
              )}
            </div>

            <div className="px-5 py-4 space-y-4">
              {[
                { icon: <Hash size={14} />, label: "사번",   key: "employeeNumber", placeholder: "예: EMP-001" },
                { icon: <Building2 size={14} />, label: "부서", key: "department",    placeholder: "예: 개발팀" },
                { icon: <Briefcase size={14} />, label: "직급", key: "position",      placeholder: "예: 선임 개발자" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                    {f.icon} {f.label}
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={form[f.key as keyof typeof form]}
                      onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full h-10 px-3 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    />
                  ) : (
                    <p className="text-sm font-medium text-foreground px-1">
                      {form[f.key as keyof typeof form] || <span className="text-muted-foreground">미등록</span>}
                    </p>
                  )}
                </div>
              ))}

              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                  <Calendar size={14} /> 입사일 <span className="text-destructive">*</span>
                </label>
                {editing ? (
                  <input
                    type="date"
                    value={form.entryDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, entryDate: e.target.value }))}
                    required
                    className="w-full h-10 px-3 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                ) : (
                  <p className="text-sm font-medium text-foreground px-1">
                    {form.entryDate || <span className="text-muted-foreground">미등록</span>}
                  </p>
                )}
              </div>
            </div>

            {editing && (
              <div className="px-5 py-4 bg-muted/30 border-t border-border flex items-center justify-between">
                <button type="button" onClick={cancelEdit} className="btn-ghost">
                  <X size={14} /> 취소
                </button>
                <button type="submit" disabled={update.isPending} className="btn-primary disabled:opacity-50">
                  <Save size={14} />
                  {update.isPending ? "저장 중…" : "저장"}
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </DashboardLayout>
  );
}
