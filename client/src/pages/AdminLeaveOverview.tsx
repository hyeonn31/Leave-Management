import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { ChevronDown, ChevronRight, Search, Users } from "lucide-react";

const LEAVE_TYPE_LABEL: Record<string, string> = {
  annual: "연차", half_am: "오전 반차", half_pm: "오후 반차",
  sick: "병가", special: "특별 휴가", unpaid: "무급 휴가",
};

function toDateStr(val: unknown): string {
  if (!val) return "-";
  const d = val instanceof Date ? val : new Date(String(val));
  if (isNaN(d.getTime())) return String(val);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export default function AdminLeaveOverview() {
  const currentYear = new Date().getFullYear();
  const [fiscalYear, setFiscalYear] = useState(currentYear);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");

  const { data, isLoading } = trpc.admin.leaveOverview.useQuery({ fiscalYear });

  const toggleExpand = (userId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  };

  const filtered = (data ?? []).filter((row) => {
    const q = search.toLowerCase();
    return !q || (row.user.name ?? "").toLowerCase().includes(q) ||
      (row.employee?.department ?? "").toLowerCase().includes(q) ||
      (row.employee?.employeeNumber ?? "").toLowerCase().includes(q);
  });

  return (
    <DashboardLayout>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
            <button key={y} onClick={() => setFiscalYear(y)} className={`pill-tab ${fiscalYear === y ? "active" : ""}`}>
              {y}년
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="이름 / 부서 / 사번 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          />
        </div>
        {data && (
          <p className="text-xs text-muted-foreground ml-auto">총 {data.length}명 · {fiscalYear}년</p>
        )}
      </div>

      {/* Table card */}
      <div className="bg-card rounded-2xl shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Users size={16} style={{ color: "var(--color-primary)" }} />
          <h3 className="font-semibold text-foreground text-sm">직원별 연차 현황</h3>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">
              {search ? "검색 결과가 없습니다" : `${fiscalYear}년 연차 데이터가 없습니다`}
            </p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-12 bg-muted/40 border-b border-border text-xs font-medium text-muted-foreground">
              <div className="col-span-1 px-3 py-3" />
              <div className="col-span-3 px-4 py-3">직원</div>
              <div className="col-span-2 px-4 py-3">부서 / 직급</div>
              <div className="col-span-2 px-4 py-3 text-center">총 부여</div>
              <div className="col-span-2 px-4 py-3 text-center">사용</div>
              <div className="col-span-2 px-4 py-3 text-center">잔여</div>
            </div>

            <div className="divide-y divide-border">
              {filtered.map((row) => {
                const isExpanded = expandedIds.has(row.user.id);
                const totalGranted = Number(row.balance.totalGranted);
                const used = Number(row.balance.used);
                const remaining = Number(row.balance.remaining);
                const usagePct = totalGranted > 0 ? Math.round((used / totalGranted) * 100) : 0;

                return (
                  <div key={row.user.id}>
                    {/* Summary row */}
                    <div
                      className="grid grid-cols-12 items-center hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => toggleExpand(row.user.id)}
                    >
                      <div className="col-span-1 px-3 py-4 flex justify-center">
                        {isExpanded
                          ? <ChevronDown size={15} className="text-muted-foreground" />
                          : <ChevronRight size={15} className="text-muted-foreground" />}
                      </div>
                      <div className="col-span-3 px-4 py-4">
                        <p className="text-sm font-semibold text-foreground">{row.user.name ?? "-"}</p>
                        <p className="text-xs text-muted-foreground">{row.employee?.employeeNumber ?? "사번 미등록"}</p>
                      </div>
                      <div className="col-span-2 px-4 py-4">
                        <p className="text-sm text-muted-foreground">{row.employee?.department ?? "-"}</p>
                        <p className="text-xs text-muted-foreground">{row.employee?.position ?? "-"}</p>
                      </div>
                      <div className="col-span-2 px-4 py-4 text-center">
                        <p className="text-lg font-bold text-foreground">{totalGranted}</p>
                        <p className="text-xs text-muted-foreground">일</p>
                      </div>
                      <div className="col-span-2 px-4 py-4 text-center">
                        <p className="text-lg font-bold text-foreground">{used}</p>
                        <p className="text-xs text-muted-foreground">{usagePct}%</p>
                      </div>
                      <div className="col-span-2 px-4 py-4 text-center">
                        <p
                          className="text-lg font-bold"
                          style={{
                            color: remaining <= 3
                              ? "oklch(45% 0.22 25)"
                              : remaining <= 7
                              ? "oklch(55% 0.18 85)"
                              : "oklch(45% 0.18 145)",
                          }}
                        >
                          {remaining}
                        </p>
                        <p className="text-xs text-muted-foreground">일</p>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="bg-muted/20 border-t border-border px-6 py-4">
                        {/* Usage bar */}
                        <div className="mb-4">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                            <span>연차 소진율</span>
                            <span className="font-medium">{usagePct}%</span>
                          </div>
                          <div className="h-2 bg-border rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(usagePct, 100)}%`,
                                background: usagePct >= 80 ? "oklch(55% 0.22 25)" : "var(--color-primary)",
                              }}
                            />
                          </div>
                        </div>

                        {/* Request history */}
                        {row.requests.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">{fiscalYear}년 연차 신청 내역이 없습니다</p>
                        ) : (
                          <div className="bg-card rounded-xl border border-border overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-border bg-muted/40">
                                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">종류</th>
                                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">시작일</th>
                                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">종료일</th>
                                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">일수</th>
                                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">사유</th>
                                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">상태</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {row.requests.map((req) => (
                                  <tr key={req.request.id} className="hover:bg-muted/30">
                                    <td className="px-3 py-2 text-muted-foreground">
                                      {LEAVE_TYPE_LABEL[req.request.leaveType] ?? req.request.leaveType}
                                    </td>
                                    <td className="px-3 py-2 font-mono">{toDateStr(req.request.startDate)}</td>
                                    <td className="px-3 py-2 font-mono">{toDateStr(req.request.endDate)}</td>
                                    <td className="px-3 py-2 text-center font-semibold">{Number(req.request.totalDays)}</td>
                                    <td className="px-3 py-2 text-muted-foreground truncate max-w-32">{req.request.reason || "-"}</td>
                                    <td className="px-3 py-2 text-center">
                                      <span className={
                                        req.request.status === "approved" ? "status-approved" :
                                        req.request.status === "rejected" ? "status-rejected" : "status-pending"
                                      }>
                                        {req.request.status === "approved" ? "승인" : req.request.status === "rejected" ? "반려" : "대기"}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
