import { trpc } from "@/lib/trpc";
import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useLocation } from "wouter";

const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data: summary, isLoading: summaryLoading } = trpc.admin.summary.useQuery({
    fiscalYear: selectedYear,
  });
  const { data: deptStats } = trpc.admin.departmentStats.useQuery({ fiscalYear: selectedYear });
  const { data: monthlyStats } = trpc.admin.monthlyStats.useQuery({ fiscalYear: selectedYear });

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
    인원: Number(d.employeeCount),
  }));

  return (
    <div className="p-8 max-w-6xl animate-fade-in">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-4 h-4 bg-red-accent" />
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            관리자 대시보드
          </p>
        </div>
        <div className="flex items-end justify-between">
          <h1 className="text-4xl font-black tracking-tight">전사 연차 현황</h1>
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
        </div>
        <div className="its-rule mt-4" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-border mb-10">
        {[
          { label: "전체 직원", value: summaryLoading ? "—" : `${summary?.totalEmployees ?? 0}명`, accent: false },
          { label: "총 부여 연차", value: summaryLoading ? "—" : `${summary?.totalGranted ?? 0}일`, accent: false },
          { label: "전사 소진율", value: summaryLoading ? "—" : `${summary?.usageRate ?? 0}%`, accent: true },
          { label: "대기 신청", value: summaryLoading ? "—" : `${summary?.pendingCount ?? 0}건`, accent: (summary?.pendingCount ?? 0) > 0 },
        ].map((item, i) => (
          <div
            key={item.label}
            className={`p-6 ${i > 0 ? "border-l border-border" : ""} ${
              item.accent ? "bg-foreground text-background" : ""
            }`}
          >
            <p className={`text-xs font-mono uppercase tracking-widest mb-2 ${item.accent ? "text-white/60" : "text-muted-foreground"}`}>
              {item.label}
            </p>
            <p className="text-3xl font-black font-mono">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex gap-3 mb-10">
        <button
          onClick={() => setLocation("/admin/requests")}
          className="px-6 py-3 border border-foreground text-sm font-semibold uppercase tracking-widest hover:bg-foreground hover:text-background transition-colors btn-press"
        >
          연차 신청 관리 →
        </button>
        <button
          onClick={() => setLocation("/admin/employees")}
          className="px-6 py-3 border border-border text-sm font-semibold uppercase tracking-widest hover:bg-muted transition-colors btn-press"
        >
          직원 관리 →
        </button>
        <button
          onClick={() => setLocation("/admin/stats")}
          className="px-6 py-3 border border-border text-sm font-semibold uppercase tracking-widest hover:bg-muted transition-colors btn-press"
        >
          통계 & 내보내기 →
        </button>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Monthly chart */}
        <div className="border border-border p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest mb-6">
            월별 연차 신청 현황
          </h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData} barSize={16}>
                <CartesianGrid strokeDasharray="2 2" stroke="#e5e5e5" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fontFamily: "IBM Plex Mono" }} />
                <YAxis tick={{ fontSize: 10, fontFamily: "IBM Plex Mono" }} />
                <Tooltip
                  contentStyle={{ border: "1px solid #e5e5e5", borderRadius: 0, fontSize: 12 }}
                />
                <Bar dataKey="건수" fill="#1a1a1a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department chart */}
        <div className="border border-border p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest mb-6">
            부서별 연차 소진율 (%)
          </h2>
          {deptChartData.length > 0 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptChartData} barSize={20} layout="vertical">
                  <CartesianGrid strokeDasharray="2 2" stroke="#e5e5e5" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fontFamily: "IBM Plex Mono" }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fontFamily: "IBM Plex Mono" }} width={60} />
                  <Tooltip
                    formatter={(v: number) => [`${v}%`]}
                    contentStyle={{ border: "1px solid #e5e5e5", borderRadius: 0, fontSize: 12 }}
                  />
                  <Bar dataKey="소진율">
                    {deptChartData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.소진율 >= 80 ? "#d4380d" : "#1a1a1a"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">부서 데이터가 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
