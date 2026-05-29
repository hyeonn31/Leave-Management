import { trpc } from "@/lib/trpc";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import { toast } from "sonner";

const TYPE_LABELS: Record<string, string> = {
  leave_request_submitted: "연차 신청 접수",
  leave_approved: "연차 승인",
  leave_rejected: "연차 반려",
  leave_renewal: "연차 갱신",
};

const TYPE_COLORS: Record<string, string> = {
  leave_request_submitted: "bg-blue-50 border-blue-200",
  leave_approved: "bg-green-50 border-green-200",
  leave_rejected: "bg-red-50 border-red-200",
  leave_renewal: "bg-amber-50 border-amber-200",
};

const TYPE_ACCENT: Record<string, string> = {
  leave_request_submitted: "bg-blue-500",
  leave_approved: "bg-green-500",
  leave_rejected: "bg-red-accent",
  leave_renewal: "bg-amber-500",
};

export default function Notifications() {
  const { data: notifications, isLoading } = trpc.notification.list.useQuery();
  const utils = trpc.useUtils();

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
    <div className="p-8 max-w-3xl animate-fade-in">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-4 h-4 bg-red-accent" />
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">알림</p>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tight">알림 센터</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                읽지 않은 알림{" "}
                <span className="font-mono font-bold text-red-accent">{unreadCount}건</span>
              </p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="flex items-center gap-2 px-4 py-2 border border-border text-sm hover:bg-muted transition-colors btn-press"
            >
              <CheckCheck className="h-4 w-4" />
              모두 읽음
            </button>
          )}
        </div>
        <div className="its-rule mt-4" />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted animate-pulse" />)}
        </div>
      ) : notifications && notifications.length > 0 ? (
        <div className="space-y-0 border border-border">
          {notifications.map((n, i) => (
            <div
              key={n.id}
              onClick={() => {
                if (!n.isRead) markRead.mutate({ id: n.id });
              }}
              className={`flex gap-4 p-4 cursor-pointer transition-colors ${
                !n.isRead ? "bg-muted/30" : ""
              } ${i < notifications.length - 1 ? "border-b border-border" : ""} hover:bg-muted/50`}
            >
              {/* Accent dot */}
              <div className="flex-shrink-0 mt-1">
                <div className={`w-2 h-2 mt-1 ${!n.isRead ? TYPE_ACCENT[n.type] ?? "bg-foreground" : "bg-border"}`} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className={`text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 border ${TYPE_COLORS[n.type] ?? ""}`}>
                      {TYPE_LABELS[n.type] ?? n.type}
                    </span>
                    <p className={`text-sm font-semibold mt-1.5 ${!n.isRead ? "" : "text-muted-foreground"}`}>
                      {n.title}
                    </p>
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                    {new Date(n.createdAt).toLocaleDateString("ko-KR")}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{n.message}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-border p-16 text-center">
          <BellOff className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">알림이 없습니다.</p>
        </div>
      )}
    </div>
  );
}
