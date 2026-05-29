import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";

const LEAVE_TYPE_LABEL: Record<string, string> = {
  annual: "연차",
  half_am: "오전 반차",
  half_pm: "오후 반차",
  sick: "병가",
  special: "특별 휴가",
  unpaid: "무급 휴가",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "대기",
  approved: "승인",
  rejected: "반려",
};

const STATUS_STYLE: Record<string, string> = {
  pending: "text-amber-700 bg-amber-50 border-amber-200",
  approved: "text-green-700 bg-green-50 border-green-200",
  rejected: "text-red-700 bg-red-50 border-red-200",
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
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const filtered = (data ?? []).filter((row) => {
    const q = search.toLowerCase();
    return (
      !q ||
      (row.user.name ?? "").toLowerCase().includes(q) ||
      (row.employee?.department ?? "").toLowerCase().includes(q) ||
      (row.employee?.employeeNumber ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-8 max-w-6xl animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-4 h-4 bg-red-accent" />
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">관리자</p>
        </div>
        <h1 className="text-4xl font-black tracking-tight">직원별 연차 현황</h1>
        <div className="its-rule mt-4" />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Year selector */}
        <div className="flex items-center gap-2">
          {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
            <button
              key={y}
              onClick={() => setFiscalYear(y)}
              className={`px-4 py-1.5 text-xs font-mono uppercase tracking-widest border transition-colors btn-press ${
                fiscalYear === y
                  ? "bg-foreground text-background border-foreground"
                  : "border-border hover:border-foreground"
              }`}
            >
              {y}년
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="이름 / 부서 / 사번 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 border border-border pl-9 pr-3 text-sm focus:outline-none focus:border-foreground transition-colors"
          />
        </div>

        {/* Summary badge */}
        {data && (
          <p className="text-xs font-mono text-muted-foreground ml-auto">
            총 {data.length}명 · {fiscalYear}년
          </p>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-border p-16 text-center">
          <p className="text-sm text-muted-foreground">
            {search ? "검색 결과가 없습니다." : `${fiscalYear}년 연차 데이터가 없습니다.`}
          </p>
        </div>
      ) : (
        <div className="border border-border">
          {/* Header row */}
          <div className="grid grid-cols-12 bg-foreground text-background">
            <div className="col-span-1 px-3 py-3" />
            <div className="col-span-3 px-4 py-3 text-xs font-mono uppercase tracking-widest">직원</div>
            <div className="col-span-2 px-4 py-3 text-xs font-mono uppercase tracking-widest">부서 / 직급</div>
            <div className="col-span-2 px-4 py-3 text-xs font-mono uppercase tracking-widest text-center">총 부여</div>
            <div className="col-span-2 px-4 py-3 text-xs font-mono uppercase tracking-widest text-center">사용</div>
            <div className="col-span-2 px-4 py-3 text-xs font-mono uppercase tracking-widest text-center">잔여</div>
          </div>

          {filtered.map((row, i) => {
            const isExpanded = expandedIds.has(row.user.id);
            const totalGranted = Number(row.balance.totalGranted);
            const used = Number(row.balance.used);
            const remaining = Number(row.balance.remaining);
            const usagePct = totalGranted > 0 ? Math.round((used / totalGranted) * 100) : 0;

            return (
              <div key={row.user.id} className={i < filtered.length - 1 ? "border-b border-border" : ""}>
                {/* Summary row */}
                <div
                  className="grid grid-cols-12 items-center hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => toggleExpand(row.user.id)}
                >
                  <div className="col-span-1 px-3 py-4 flex justify-center">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="col-span-3 px-4 py-4">
                    <p className="text-sm font-semibold">{row.user.name ?? "-"}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">
                      {row.employee?.employeeNumber ?? "사번 미등록"}
                    </p>
                  </div>
                  <div className="col-span-2 px-4 py-4">
                    <p className="text-sm text-muted-foreground">{row.employee?.department ?? "-"}</p>
                    <p className="text-[10px] text-muted-foreground">{row.employee?.position ?? "-"}</p>
                  </div>
                  <div className="col-span-2 px-4 py-4 text-center">
                    <p className="text-lg font-black">{totalGranted}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">일</p>
                  </div>
                  <div className="col-span-2 px-4 py-4 text-center">
                    <p className="text-lg font-black">{used}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{usagePct}%</p>
                  </div>
                  <div className="col-span-2 px-4 py-4 text-center">
                    <p
                      className={`text-lg font-black ${
                        remaining <= 3
                          ? "text-red-accent"
                          : remaining <= 7
                          ? "text-amber-600"
                          : "text-green-700"
                      }`}
                    >
                      {remaining}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground">일</p>
                  </div>
                </div>

                {/* Expanded: usage bar + request history */}
                {isExpanded && (
                  <div className="bg-muted/20 border-t border-border px-6 py-4">
                    {/* Usage bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1">
                        <span>연차 소진율</span>
                        <span>{usagePct}%</span>
                      </div>
                      <div className="h-1.5 bg-border w-full">
                        <div
                          className="h-full bg-foreground transition-all"
                          style={{ width: `${Math.min(usagePct, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Request history */}
                    {row.requests.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">
                        {fiscalYear}년 연차 신청 내역이 없습니다.
                      </p>
                    ) : (
                      <div className="border border-border bg-background">
                        {/* Sub-header */}
                        <div className="grid grid-cols-12 bg-foreground/5 border-b border-border">
                          <div className="col-span-2 px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">종류</div>
                          <div className="col-span-2 px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">시작일</div>
                          <div className="col-span-2 px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">종료일</div>
                          <div className="col-span-1 px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center">일수</div>
                          <div className="col-span-3 px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">사유</div>
                          <div className="col-span-2 px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center">상태</div>
                        </div>
                        {row.requests.map((req, j) => (
                          <div
                            key={req.request.id}
                            className={`grid grid-cols-12 items-center ${
                              j < row.requests.length - 1 ? "border-b border-border" : ""
                            }`}
                          >
                            <div className="col-span-2 px-3 py-2.5 text-xs text-muted-foreground">
                              {LEAVE_TYPE_LABEL[req.request.leaveType] ?? req.request.leaveType}
                            </div>
                            <div className="col-span-2 px-3 py-2.5 text-xs font-mono">
                              {toDateStr(req.request.startDate)}
                            </div>
                            <div className="col-span-2 px-3 py-2.5 text-xs font-mono">
                              {toDateStr(req.request.endDate)}
                            </div>
                            <div className="col-span-1 px-3 py-2.5 text-xs font-mono text-center font-semibold">
                              {Number(req.request.totalDays)}
                            </div>
                            <div className="col-span-3 px-3 py-2.5 text-xs text-muted-foreground truncate">
                              {req.request.reason || "-"}
                            </div>
                            <div className="col-span-2 px-3 py-2.5 flex justify-center">
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 border uppercase ${
                                  STATUS_STYLE[req.request.status]
                                }`}
                              >
                                {STATUS_LABEL[req.request.status]}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
