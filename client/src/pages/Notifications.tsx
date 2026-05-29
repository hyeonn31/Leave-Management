import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Bell, BellOff, CheckCheck, CalendarCheck, CalendarX, Calendar, Gift, UserPlus, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  leave_request_submitted:  { label: "연차 신청",    icon: <Calendar size={14} />,      color: "var(--color-primary)", bg: "oklch(93% 0.06 264)" },
  leave_approved:           { label: "연차 승인",    icon: <CalendarCheck size={14} />,  color: "oklch(55% 0.18 145)", bg: "oklch(93% 0.06 145)" },
  leave_rejected:           { label: "연차 반려",    icon: <CalendarX size={14} />,      color: "oklch(55% 0.22 25)",  bg: "oklch(95% 0.04 25)" },
  leave_renewal:            { label: "연차 갱신",    icon: <Gift size={14} />,           color: "oklch(60% 0.18 85)",  bg: "oklch(95% 0.04 85)" },
  new_signup:               { label: "신규 가입",    icon: <UserPlus size={14} />,       color: "oklch(55% 0.18 300)", bg: "oklch(93% 0.04 300)" },
  team_leave_request:       { label: "팀 연차 신청", icon: <Calendar size={14} />,      color: "oklch(55% 0.18 220)", bg: "oklch(93% 0.06 220)" },
  team_leave_approved:      { label: "팀장 승인",    icon: <CalendarCheck size={14} />,  color: "oklch(55% 0.18 145)", bg: "oklch(93% 0.06 145)" },
  team_leave_rejected:      { label: "팀장 반려",    icon: <CalendarX size={14} />,      color: "oklch(55% 0.22 25)",  bg: "oklch(95% 0.04 25)" },
};

function getNavigationPath(type: string, isAdmin: boolean): string | null {
  switch (type) {
    case "leave_request_submitted":
    case "team_leave_request":
      return isAdmin ? "/admin/requests" : "/leave/history";
    case "leave_approved":
    case "leave_rejected":
    case "team_leave_approved":
    case "team_leave_rejected":
      return "/leave/history";
    case "leave_renewal":
      return "/";
    case "new_signup":
      return "/admin/employees";
    default:
      return null;
  }
}

export default function Notifications() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isAdmin = user?.role === "admin";
  const { data: notifications, isLoading } = trpc.notification.list.useQuery();
  const utils = trpc.useUtils();

  const handleClick = (n: { id: number; isRead: boolean; type: string }) => {
    if (!n.isRead) markRead.mutate({ id: n.id });
    const path = getNavigationPath(n.type, isAdmin);
    if (path) navigate(path);
  };

  const markRead = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
      utils.notification.unreadCount.invalidate();
    },
  });
  const markAllRead = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      toast.success("모든 알림을 읽음 처리했습니다.");
      utils.notification.list.invalidate();
      utils.notification.unreadCount.invalidate();
    },
  });

  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;

  return (
    <DashboardLayout>
      {/* Action bar */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">
          {unreadCount > 0 ? (
            <>읽지 않은 알림 <span className="font-semibold text-primary">{unreadCount}건</span></>
          ) : (
            "모든 알림을 확인했습니다"
          )}
        </p>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="btn-ghost"
          >
            <CheckCheck size={14} />
            모두 읽음
          </button>
        )}
      </div>

      {/* List */}
      <div className="bg-card rounded-2xl shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (notifications ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BellOff size={36} className="text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-muted-foreground">알림이 없습니다</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {(notifications ?? []).map((n) => {
              const cfg = TYPE_CONFIG[n.type] ?? {
                label: n.type,
                icon: <Bell size={14} />,
                color: "var(--color-primary)",
                bg: "oklch(93% 0.06 264)",
              };
              return (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex items-start gap-4 px-5 py-4 cursor-pointer transition-colors hover:bg-muted/30 ${!n.isRead ? "bg-secondary/40" : ""}`}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    {cfg.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        {cfg.label}
                      </span>
                      {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                    </div>
                    <p className={`text-sm font-semibold ${!n.isRead ? "text-foreground" : "text-muted-foreground"}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 mt-1">
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(n.createdAt).toLocaleDateString("ko-KR")}
                    </p>
                    {getNavigationPath(n.type, isAdmin) && <ChevronRight size={14} className="text-muted-foreground" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
