import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Users, UserCheck } from "lucide-react";

type TeamForm = {
  name: string;
  description: string;
  approverId: string;
};

const EMPTY_FORM: TeamForm = { name: "", description: "", approverId: "" };

export default function AdminTeams() {
  const utils = trpc.useUtils();
  const { data: teams = [], isLoading } = trpc.team.listAll.useQuery();
  const { data: allUsers = [] } = trpc.employee.listAllUsers.useQuery();

  const [showDialog, setShowDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<number | null>(null);
  const [form, setForm] = useState<TeamForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  // Assign employee to team dialog
  const [showAssign, setShowAssign] = useState(false);
  const [assignTeamId, setAssignTeamId] = useState<number | null>(null);
  const [assignUserId, setAssignUserId] = useState<string>("");

  const createTeam = trpc.team.create.useMutation({
    onSuccess: () => {
      toast.success("팀이 생성되었습니다.");
      utils.team.listAll.invalidate();
      setShowDialog(false);
      setForm(EMPTY_FORM);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateTeam = trpc.team.update.useMutation({
    onSuccess: () => {
      toast.success("팀 정보가 수정되었습니다.");
      utils.team.listAll.invalidate();
      setShowDialog(false);
      setEditTarget(null);
      setForm(EMPTY_FORM);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteTeam = trpc.team.delete.useMutation({
    onSuccess: () => {
      toast.success("팀이 삭제되었습니다.");
      utils.team.listAll.invalidate();
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const assignEmployee = trpc.team.assignEmployee.useMutation({
    onSuccess: () => {
      toast.success("팀 배정이 완료되었습니다.");
      utils.team.listAll.invalidate();
      setShowAssign(false);
      setAssignUserId("");
    },
    onError: (e) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setShowDialog(true);
  };

  const openEdit = (t: any) => {
    setEditTarget(t.team.id);
    setForm({
      name: t.team.name,
      description: t.team.description ?? "",
      approverId: t.team.approverId ? String(t.team.approverId) : "",
    });
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return toast.error("팀 이름을 입력하세요.");
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      approverId: form.approverId ? Number(form.approverId) : undefined,
    };
    if (editTarget) {
      updateTeam.mutate({ teamId: editTarget, ...payload });
    } else {
      createTeam.mutate(payload);
    }
  };

  const openAssign = (teamId: number) => {
    setAssignTeamId(teamId);
    setAssignUserId("");
    setShowAssign(true);
  };

  const handleAssign = () => {
    if (!assignUserId || !assignTeamId) return;
    assignEmployee.mutate({ userId: Number(assignUserId), teamId: assignTeamId });
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">팀 관리</h1>
          <p className="text-sm text-muted-foreground mt-0.5">팀을 생성하고 팀장(승인자)을 지정하세요</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus size={16} />
          팀 생성
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : teams.length === 0 ? (
        <div className="bg-card rounded-2xl p-12 text-center">
          <Users size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">아직 팀이 없습니다</p>
          <p className="text-xs text-muted-foreground mt-1">팀을 생성하고 직원을 배정하세요</p>
          <Button onClick={openCreate} className="mt-4 gap-2" variant="outline">
            <Plus size={14} />
            첫 번째 팀 만들기
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {teams.map((t) => (
            <div key={t.team.id} className="bg-card rounded-2xl p-5 shadow-card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-base">{t.team.name}</h3>
                    {t.approver && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <UserCheck size={11} />
                        승인자: {t.approver.name}
                      </Badge>
                    )}
                    {!t.approver && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        승인자 미지정
                      </Badge>
                    )}
                  </div>
                  {t.team.description && (
                    <p className="text-sm text-muted-foreground">{t.team.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => openAssign(t.team.id)} className="gap-1 text-xs">
                    <Users size={13} />
                    직원 배정
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(t.team.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? "팀 수정" : "팀 생성"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">팀 이름 *</label>
              <Input
                placeholder="예: 개발팀"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">설명</label>
              <Input
                placeholder="팀 설명 (선택)"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">승인자 (팀장)</label>
              <Select value={form.approverId} onValueChange={(v) => setForm((f) => ({ ...f, approverId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="승인자를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">미지정</SelectItem>
                  {(allUsers as any[]).map((u: any) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">선택한 사용자가 이 팀의 연차 신청을 승인/반려할 수 있습니다.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>취소</Button>
            <Button onClick={handleSave} disabled={createTeam.isPending || updateTeam.isPending}>
              {editTarget ? "수정" : "생성"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign employee dialog */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>직원 팀 배정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">직원 선택</label>
              <Select value={assignUserId} onValueChange={setAssignUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="직원을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {(allUsers as any[]).map((u: any) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssign(false)}>취소</Button>
            <Button onClick={handleAssign} disabled={!assignUserId || assignEmployee.isPending}>
              배정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>팀 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            팀을 삭제하면 소속 직원들의 팀 배정이 해제됩니다. 계속하시겠습니까?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>취소</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteTeam.mutate({ teamId: deleteTarget })}
              disabled={deleteTeam.isPending}
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
