import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, CalendarCheck } from "lucide-react";

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: "연차",
  half_am: "오전 반차",
  half_pm: "오후 반차",
  sick: "병가",
  special: "특별 휴가",
  unpaid: "무급 휴가",
};

export default function TeamApproval() {
  const utils = trpc.useUtils();
  const { data: pendingList = [], isLoading: pendingLoading } = trpc.team.getPendingRequests.useQuery();
  const { data: allList = [], isLoading: allLoading } = trpc.team.getAllRequests.useQuery();

  const [rejectTarget, setRejectTarget] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const approve = trpc.team.approveRequest.useMutation({
    onSuccess: () => {
      toast.success("승인되었습니다.");
      utils.team.getPendingRequests.invalidate();
      utils.team.getAllRequests.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const reject = trpc.team.rejectRequest.useMutation({
    onSuccess: () => {
      toast.success("반려되었습니다.");
      utils.team.getPendingRequests.invalidate();
      utils.team.getAllRequests.invalidate();
      setRejectTarget(null);
      setRejectReason("");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleReject = () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    reject.mutate({ requestId: rejectTarget, reason: rejectReason.trim() });
  };

  const statusBadge = (status: string) => {
    if (status === "approved") return <Badge className="bg-green-100 text-green-700 border-0">승인</Badge>;
    if (status === "rejected") return <Badge className="bg-red-100 text-red-700 border-0">반려</Badge>;
    return <Badge className="bg-yellow-100 text-yellow-700 border-0">대기</Badge>;
  };

  const RequestCard = ({ r, showActions }: { r: any; showActions: boolean }) => (
    <div className="bg-card rounded-xl p-4 shadow-sm border border-border">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm">{r.user?.name ?? "알 수 없음"}</span>
            <span className="text-xs text-muted-foreground">{r.user?.email}</span>
            {r.teamName && (
              <Badge variant="outline" className="text-xs">{r.teamName}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{LEAVE_TYPE_LABELS[r.request?.leaveType] ?? r.request?.leaveType}</span>
            <span>·</span>
            <span>{r.request?.startDate} ~ {r.request?.endDate}</span>
            <span>·</span>
            <span className="font-medium">{r.request?.totalDays}일</span>
          </div>
          {r.request?.reason && (
            <p className="text-xs text-muted-foreground mt-1">사유: {r.request.reason}</p>
          )}
          {r.request?.rejectionReason && (
            <p className="text-xs text-red-500 mt-1">반려 사유: {r.request.rejectionReason}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {statusBadge(r.request?.status)}
          {showActions && r.request?.status === "pending" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                onClick={() => approve.mutate({ requestId: r.request.id })}
                disabled={approve.isPending}
              >
                <CheckCircle size={13} />
                승인
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={() => { setRejectTarget(r.request.id); setRejectReason(""); }}
              >
                <XCircle size={13} />
                반려
              </Button>
            </>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        신청일: {new Date(r.request?.createdAt).toLocaleDateString("ko-KR")}
      </p>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-xl font-bold">팀 연차 승인</h1>
        <p className="text-sm text-muted-foreground mt-0.5">내 팀 직원들의 연차 신청을 승인하거나 반려하세요</p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="mb-4">
          <TabsTrigger value="pending" className="gap-2">
            <Clock size={14} />
            대기 중
            {(pendingList as any[]).length > 0 && (
              <Badge className="ml-1 bg-primary text-primary-foreground text-xs px-1.5 py-0 h-4">
                {(pendingList as any[]).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2">
            <CalendarCheck size={14} />
            전체 이력
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {pendingLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
            </div>
          ) : (pendingList as any[]).length === 0 ? (
            <div className="bg-card rounded-2xl p-12 text-center">
              <CheckCircle size={36} className="text-green-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">대기 중인 신청이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(pendingList as any[]).map((r, i) => (
                <RequestCard key={r.request?.id ?? i} r={r} showActions />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all">
          {allLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
            </div>
          ) : (allList as any[]).length === 0 ? (
            <div className="bg-card rounded-2xl p-12 text-center">
              <CalendarCheck size={36} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">이력이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(allList as any[]).map((r, i) => (
                <RequestCard key={r.request?.id ?? i} r={r} showActions />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Reject reason dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={() => setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>반려 사유 입력</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="반려 사유를 입력하세요"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>취소</Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim() || reject.isPending}
            >
              반려
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
