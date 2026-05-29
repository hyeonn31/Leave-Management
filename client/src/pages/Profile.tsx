import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { User, Building2, Briefcase, Calendar, Hash, Pencil, X, Save, ShieldCheck, Clock, Info } from "lucide-react";

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
  const isAdmin = user?.role === "admin";

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
                  isAdmin
                    ? { background: "oklch(93% 0.06 264)", color: "var(--color-primary)" }
                    : { background: "oklch(93% 0.02 264)", color: "oklch(50% 0.02 264)" }
                }
              >
                {isAdmin ? "HR 관리자" : "일반 직원"}
              </span>
            </div>
          </div>
        </div>

        {/* Employee profile card */}
        {!hasProfile && !isAdmin ? (
          /* ── 미등록 일반 직원: 관리자 처리 대기 안내 ── */
          <div className="bg-card rounded-2xl shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <User size={16} style={{ color: "var(--color-primary)" }} />
              <h3 className="font-semibold text-foreground text-sm">직원 정보</h3>
            </div>
            <div className="px-6 py-8 flex flex-col items-center text-center">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "oklch(96% 0.04 85)" }}
              >
                <Clock size={24} style={{ color: "oklch(55% 0.18 85)" }} />
              </div>
              <p className="font-semibold text-foreground mb-1">관리자가 등록을 처리 중입니다</p>
              <p className="text-sm text-muted-foreground mb-4">
                직원 정보 등록은 HR 관리자만 처리할 수 있습니다.<br />
                등록이 완료되면 연차가 자동으로 산정됩니다.
              </p>
              <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-muted/50 border border-border w-full max-w-sm text-left">
                <Info size={14} className="text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  등록 처리가 지연되는 경우 HR 담당자에게 직접 문의해 주세요.
                </p>
              </div>
            </div>
          </div>
        ) : hasProfile ? (
          /* ── 등록된 직원: 정보 표시 (일반 직원은 읽기 전용) ── */
          <form onSubmit={handleSubmit} className="bg-card rounded-2xl shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User size={16} style={{ color: "var(--color-primary)" }} />
                <h3 className="font-semibold text-foreground text-sm">직원 정보</h3>
              </div>
              {/* 수정 버튼은 관리자만 표시 */}
              {isAdmin && !editing && (
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
                  {editing && isAdmin ? (
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
                {editing && isAdmin ? (
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

            {editing && isAdmin && (
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
        ) : null}
      </div>
    </DashboardLayout>
  );
}
