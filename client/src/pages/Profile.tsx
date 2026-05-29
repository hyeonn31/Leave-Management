import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { User, Building2, Briefcase, Calendar, Hash } from "lucide-react";

/**
 * Convert a Date object or ISO string returned from the DB to YYYY-MM-DD
 * so it works correctly with <input type="date">.
 *
 * mysql2 returns DATE columns as JavaScript Date objects (UTC midnight).
 * String(date) gives "2020-01-15T00:00:00.000Z" which is NOT valid for
 * <input type="date"> — the browser ignores it and shows an empty field.
 * We must use UTC date parts to avoid timezone-shift bugs.
 */
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

  const [form, setForm] = useState({
    employeeNumber: "",
    department: "",
    position: "",
    entryDate: "",
  });
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

  if (isLoading) {
    return (
      <div className="p-8 max-w-2xl">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted animate-pulse" />)}
        </div>
      </div>
    );
  }

  const hasProfile = !!profile?.employee?.entryDate;

  return (
    <div className="p-8 max-w-2xl animate-fade-in">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-4 h-4 bg-red-accent" />
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            내 프로필
          </p>
        </div>
        <h1 className="text-4xl font-black tracking-tight">직원 정보</h1>
        <div className="its-rule mt-4" />
      </div>

      {/* Auth info (read-only) */}
      <div className="border border-border p-6 mb-6">
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
          계정 정보
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">이름</p>
            <p className="font-semibold">{user?.name ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">이메일</p>
            <p className="font-semibold font-mono text-sm">{user?.email ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">역할</p>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 uppercase border ${
                user?.role === "admin"
                  ? "border-red-accent text-red-accent bg-red-accent-light"
                  : "border-border text-muted-foreground"
              }`}
            >
              {user?.role === "admin" ? "HR 관리자" : "일반 직원"}
            </span>
          </div>
        </div>
      </div>

      {/* Employee profile */}
      {!hasProfile && !editing && (
        <div className="border border-dashed border-border p-8 text-center mb-6">
          <User className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium mb-1">직원 정보가 등록되지 않았습니다.</p>
          <p className="text-xs text-muted-foreground mb-4">
            입사일을 등록해야 연차가 자동으로 산정됩니다.
          </p>
          <button
            onClick={() => setEditing(true)}
            className="px-6 py-2 bg-foreground text-background text-sm font-semibold uppercase tracking-widest hover:bg-red-accent transition-colors btn-press"
          >
            정보 등록하기
          </button>
        </div>
      )}

      {(hasProfile || editing) && (
        <form onSubmit={handleSubmit} className="border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              직원 정보
            </p>
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs font-mono uppercase tracking-widest hover:text-red-accent transition-colors"
              >
                수정
              </button>
            )}
          </div>

          <div className="space-y-5">
            <FormField
              icon={<Hash className="h-4 w-4" />}
              label="사번"
              value={form.employeeNumber}
              onChange={(v) => setForm((f) => ({ ...f, employeeNumber: v }))}
              placeholder="예: EMP-001"
              disabled={!editing}
            />
            <FormField
              icon={<Building2 className="h-4 w-4" />}
              label="부서"
              value={form.department}
              onChange={(v) => setForm((f) => ({ ...f, department: v }))}
              placeholder="예: 개발팀"
              disabled={!editing}
            />
            <FormField
              icon={<Briefcase className="h-4 w-4" />}
              label="직급"
              value={form.position}
              onChange={(v) => setForm((f) => ({ ...f, position: v }))}
              placeholder="예: 선임 개발자"
              disabled={!editing}
            />
            <FormField
              icon={<Calendar className="h-4 w-4" />}
              label="입사일"
              value={form.entryDate}
              onChange={(v) => setForm((f) => ({ ...f, entryDate: v }))}
              placeholder="YYYY-MM-DD"
              type="date"
              disabled={!editing}
              required
            />
          </div>

          {editing && (
            <div className="flex gap-3 mt-8 pt-6 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  if (profile?.employee) {
                    setForm({
                      employeeNumber: profile.employee.employeeNumber ?? "",
                      department: profile.employee.department ?? "",
                      position: profile.employee.position ?? "",
                      entryDate: toDateInputValue(profile.employee.entryDate),
                    });
                  }
                }}
                className="flex-1 h-11 border border-border text-sm font-semibold uppercase tracking-widest hover:bg-muted transition-colors btn-press"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={update.isPending}
                className="flex-1 h-11 bg-foreground text-background text-sm font-semibold uppercase tracking-widest hover:bg-red-accent transition-colors btn-press disabled:opacity-40"
              >
                {update.isPending ? "저장 중..." : "저장"}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

function FormField({
  icon,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled,
  required,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <div>
      <label className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
        {icon}
        {label}
        {required && <span className="text-red-accent">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className="w-full h-11 border border-border px-4 text-sm focus:outline-none focus:border-foreground transition-colors disabled:bg-muted disabled:text-muted-foreground font-sans"
      />
    </div>
  );
}
