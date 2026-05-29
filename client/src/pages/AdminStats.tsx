import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Download, TrendingUp, Users, Calendar } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

export default function AdminStats() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data: allBalances, isLoading: balancesLoading } = trpc.leaveBalance.getAllForYear.useQuery({
    fiscalYear: selectedYear,
  });
  const { data: deptStats } = trpc.admin.departmentStats.useQuery({ fiscalYear: selectedYear });
  const { data: monthlyStats } = trpc.admin.monthlyStats.useQuery({ fiscalYear: selectedYear });
  const { data: csvData, refetch: fetchCsv, isFetching: csvLoading } = trpc.admin.exportCsv.useQuery(
    { fiscalYear: selectedYear },
    { enabled: false }
  );

  const handleExportCsv = async () => {
    const result = await fetchCsv();
    if (result.data?.csv) {
      const blob = new Blob(["\uFEFF" + result.data.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `연차_데이터_${selectedYear}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV 파일이 다운로드되었습니다.");
    }
  };

  const monthlyChartData = MONTHS.map((month, i) => {
    const stat = monthlyStats?.find((s) => Number(s.month) === i + 1);
    return {
      month,
      건수: Number(stat?.count ?? 0),
      일수: Number(stat?.totalDays ?? 0),
    };
  });

  const deptChartData = (deptStats ?? []).map((d) => ({
    name: d.department ?? "미지정",
    소진율: d.totalGranted > 0 ? Math.round((Number(d.totalUsed) / Number(d.totalGranted)) * 100) : 0,
    총부여: Number(d.totalGranted),
    사용: Number(d.totalUsed),
    인원: Number(d.employeeCount),
  }));

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
        <div className="flex items-end justify-between">
          <h1 className="text-4xl font-black tracking-tight">통계 & 내보내기</h1>
          <div className="flex items-center gap-3">
            <div className="flex gap-0 border border-border">
              {[currentYear - 1, currentYear].map((y) => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  className={`px-4 py-2 text-sm font-mono transition-colors btn-press ${
                    selectedYear === y ? "bg-foreground text-background" : "hover:bg-muted"
                  }`}
                >
                  {y}년
                </button>
              ))}
            </div>
            <button
              onClick={handleExportCsv}
              disabled={csvLoading}
              className="flex items-center gap-2 px-5 py-2 bg-red-accent text-white text-sm font-semibold uppercase tracking-widest hover:bg-red-700 transition-colors btn-press disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              {csvLoading ? "생성 중..." : "CSV 내보내기"}
            </button>
          </div>
        </div>
        <div className="its-rule mt-4" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
        {/* Monthly trend */}
        <div className="border border-border p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest mb-6">월별 연차 신청 추이</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyChartData}>
                <CartesianGrid strokeDasharray="2 2" stroke="#e5e5e5" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fontFamily: "IBM Plex Mono" }} />
                <YAxis tick={{ fontSize: 10, fontFamily: "IBM Plex Mono" }} />
                <Tooltip contentStyle={{ border: "1px solid #e5e5e5", borderRadius: 0, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} />
                <Line type="monotone" dataKey="건수" stroke="#1a1a1a" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="일수" stroke="#d4380d" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department comparison */}
        <div className="border border-border p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest mb-6">부서별 연차 현황</h2>
          {deptChartData.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptChartData} barSize={16}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#e5e5e5" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: "IBM Plex Mono" }} />
                  <YAxis tick={{ fontSize: 10, fontFamily: "IBM Plex Mono" }} />
                  <Tooltip contentStyle={{ border: "1px solid #e5e5e5", borderRadius: 0, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} />
                  <Bar dataKey="총부여" fill="#e5e5e5" />
                  <Bar dataKey="사용" fill="#1a1a1a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">부서 데이터가 없습니다.</p>
            </div>
          )}
        </div>
      </div>

      {/* Per-employee balance table */}
      <div className="border border-border">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest">직원별 연차 현황</h2>
          <span className="text-xs font-mono text-muted-foreground">
            {selectedYear}년 기준
          </span>
        </div>

        {balancesLoading ? (
          <div className="p-6 space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-muted animate-pulse" />)}
          </div>
        ) : allBalances && allBalances.length > 0 ? (
          <>
            {/* Table header */}
            <div className="grid grid-cols-12 bg-muted border-b border-border">
              <div className="col-span-3 px-4 py-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">이름</div>
              <div className="col-span-2 px-4 py-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">부서</div>
              <div className="col-span-2 px-4 py-2 text-xs font-mono uppercase tracking-widest text-muted-foreground text-right">총 부여</div>
              <div className="col-span-2 px-4 py-2 text-xs font-mono uppercase tracking-widest text-muted-foreground text-right">사용</div>
              <div className="col-span-2 px-4 py-2 text-xs font-mono uppercase tracking-widest text-muted-foreground text-right">잔여</div>
              <div className="col-span-1 px-4 py-2 text-xs font-mono uppercase tracking-widest text-muted-foreground text-right">소진율</div>
            </div>
            {allBalances.map((row, i) => {
              const total = Number(row.balance.totalGranted);
              const used = Number(row.balance.used);
              const remaining = Number(row.balance.remaining);
              const rate = total > 0 ? Math.round((used / total) * 100) : 0;
              return (
                <div
                  key={row.balance.id}
                  className={`grid grid-cols-12 items-center ${
                    i < allBalances.length - 1 ? "border-b border-border" : ""
                  } hover:bg-muted/30 transition-colors`}
                >
                  <div className="col-span-3 px-4 py-3">
                    <p className="text-sm font-semibold">{row.user.name ?? "-"}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{row.user.email}</p>
                  </div>
                  <div className="col-span-2 px-4 py-3 text-sm text-muted-foreground">
                    {row.employee?.department ?? "-"}
                  </div>
                  <div className="col-span-2 px-4 py-3 text-sm font-mono text-right">{total}일</div>
                  <div className="col-span-2 px-4 py-3 text-sm font-mono text-right">{used}일</div>
                  <div className="col-span-2 px-4 py-3 text-sm font-mono text-right font-bold">{remaining}일</div>
                  <div className="col-span-1 px-4 py-3 text-right">
                    <span
                      className={`text-xs font-mono font-bold ${
                        rate >= 80 ? "text-red-accent" : "text-muted-foreground"
                      }`}
                    >
                      {rate}%
                    </span>
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <div className="p-16 text-center">
            <p className="text-sm text-muted-foreground">연차 데이터가 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
