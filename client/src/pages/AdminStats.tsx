import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, Cell,
} from "recharts";

const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

export default function AdminStats() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data: allBalances, isLoading: balancesLoading } = trpc.leaveBalance.getAllForYear.useQuery({ fiscalYear: selectedYear });
  const { data: deptStats } = trpc.admin.departmentStats.useQuery({ fiscalYear: selectedYear });
  const { data: monthlyStats } = trpc.admin.monthlyStats.useQuery({ fiscalYear: selectedYear });
  const { refetch: fetchCsv, isFetching: csvLoading } = trpc.admin.exportCsv.useQuery(
    { fiscalYear: selectedYear }, { enabled: false }
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
    return { month, 건수: Number(stat?.count ?? 0), 일수: Number(stat?.totalDays ?? 0) };
  });

  const deptChartData = (deptStats ?? []).map((d) => ({
    name: d.department ?? "미지정",
    소진율: d.totalGranted > 0 ? Math.round((Number(d.totalUsed) / Number(d.totalGranted)) * 100) : 0,
    총부여: Number(d.totalGranted),
    사용: Number(d.totalUsed),
    인원: Number(d.employeeCount),
  }));

  return (
    <DashboardLayout>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          {[currentYear - 1, currentYear].map((y) => (
            <button key={y} onClick={() => setSelectedYear(y)} className={`pill-tab ${selectedYear === y ? "active" : ""}`}>
              {y}년
            </button>
          ))}
        </div>
        <button onClick={handleExportCsv} disabled={csvLoading} className="btn-primary disabled:opacity-50">
          <Download size={14} />
          {csvLoading ? "생성 중…" : "CSV 내보내기"}
        </button>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-card rounded-2xl shadow-card p-5">
          <h3 className="font-semibold text-foreground text-sm mb-4">월별 연차 신청 추이</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(92% 0.01 264)" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid oklch(90% 0.02 264)", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="건수" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="일수" stroke="oklch(60% 0.18 145)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card rounded-2xl shadow-card p-5">
          <h3 className="font-semibold text-foreground text-sm mb-4">부서별 연차 현황</h3>
          {deptChartData.length > 0 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptChartData} barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(92% 0.01 264)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid oklch(90% 0.02 264)", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="총부여" fill="oklch(88% 0.04 264)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="사용" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">부서 데이터가 없습니다</p>
            </div>
          )}
        </div>
      </div>

      {/* Employee balance table */}
      <div className="bg-card rounded-2xl shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">직원별 연차 현황</h3>
          <span className="text-xs text-muted-foreground">{selectedYear}년 기준</span>
        </div>

        {balancesLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : (allBalances ?? []).length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">연차 데이터가 없습니다</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">이름</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">부서</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">총 부여</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">사용</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">잔여</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground">소진율</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(allBalances as any[]).map((row) => {
                  const total = Number(row.balance.totalGranted);
                  const used = Number(row.balance.used);
                  const remaining = Number(row.balance.remaining);
                  const rate = total > 0 ? Math.round((used / total) * 100) : 0;
                  return (
                    <tr key={row.balance.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-foreground">{row.user.name ?? "-"}</p>
                        <p className="text-xs text-muted-foreground">{row.user.email}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.employee?.department ?? "-"}</td>
                      <td className="px-4 py-3 text-right font-medium">{total}일</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{used}일</td>
                      <td className="px-4 py-3 text-right font-bold" style={{ color: "var(--color-primary)" }}>{remaining}일</td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={
                            rate >= 80
                              ? { background: "oklch(95% 0.04 25)", color: "oklch(45% 0.22 25)" }
                              : { background: "oklch(93% 0.06 264)", color: "var(--color-primary)" }
                          }
                        >
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
