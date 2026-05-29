import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Cell,
} from "recharts";
import { useLocation } from "wouter";
import { Users, CalendarDays, TrendingUp, Clock, ArrowRight } from "lucide-react";

const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data: summary, isLoading: summaryLoading } = trpc.admin.summary.useQuery({ fiscalYear: selectedYear });
  const { data: deptStats } = trpc.admin.departmentStats.useQuery({ fiscalYear: selectedYear });
  const { data: monthlyStats } = trpc.admin.monthlyStats.useQuery({ fiscalYear: selectedYear });

  const monthlyChartData = MONTHS.map((month, i) => {
    const stat = monthlyStats?.find((s) => Number(s.month) === i + 1);
    return { month, 건수: Number(stat?.count ?? 0), 일수: Number(stat?.totalDays ?? 0) };
  });

  const deptChartData = (deptStats ?? []).map((d) => ({
    name: d.department ?? "미지정",
    소진율: d.totalGranted > 0 ? Math.round((Number(d.totalUsed) / Number(d.totalGranted)) * 100) : 0,
    인원: Number(d.employeeCount),
  }));

  const kpis = [
    { icon: <Users size={18} />, label: "전체 직원",   value: summaryLoading ? "—" : `${summary?.totalEmployees ?? 0}명`,  color: "var(--color-primary)" },
    { icon: <CalendarDays size={18} />, label: "총 부여 연차", value: summaryLoading ? "—" : `${summary?.totalGranted ?? 0}일`,   color: "oklch(60% 0.18 145)" },
    { icon: <TrendingUp size={18} />, label: "전사 소진율",  value: summaryLoading ? "—" : `${summary?.usageRate ?? 0}%`,    color: "oklch(60% 0.18 85)" },
    { icon: <Clock size={18} />, label: "대기 신청",    value: summaryLoading ? "—" : `${summary?.pendingCount ?? 0}건`,   color: (summary?.pendingCount ?? 0) > 0 ? "oklch(55% 0.22 25)" : "var(--color-primary)" },
  ];

  const quickLinks = [
    { label: "연차 신청 관리", path: "/admin/requests", desc: "승인·반려 처리" },
    { label: "직원 관리",     path: "/admin/employees", desc: "프로필·연차 재계산" },
    { label: "통계 & 내보내기", path: "/admin/stats",  desc: "CSV 다운로드" },
  ];

  return (
    <DashboardLayout>
      {/* Year tabs */}
      <div className="flex items-center gap-2 mb-6">
        {[currentYear - 1, currentYear].map((y) => (
          <button key={y} onClick={() => setSelectedYear(y)} className={`pill-tab ${selectedYear === y ? "active" : ""}`}>
            {y}년
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className="bg-card rounded-2xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "oklch(93% 0.06 264)", color: k.color }}>
                {k.icon}
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {quickLinks.map((l) => (
          <button
            key={l.path}
            onClick={() => setLocation(l.path)}
            className="bg-card rounded-2xl p-4 shadow-card text-left hover:shadow-lg transition-shadow group"
          >
            <p className="font-semibold text-foreground text-sm mb-0.5">{l.label}</p>
            <p className="text-xs text-muted-foreground">{l.desc}</p>
            <ArrowRight size={14} className="mt-2 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly line chart */}
        <div className="bg-card rounded-2xl shadow-card p-5">
          <h3 className="font-semibold text-foreground text-sm mb-4">월별 연차 신청 건수</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(92% 0.01 264)" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid oklch(90% 0.02 264)", fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="건수"
                  stroke="var(--color-primary)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "var(--color-primary)" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Dept bar chart */}
        <div className="bg-card rounded-2xl shadow-card p-5">
          <h3 className="font-semibold text-foreground text-sm mb-4">부서별 연차 소진율 (%)</h3>
          {deptChartData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptChartData} barSize={18} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(92% 0.01 264)" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={56} />
                  <Tooltip
                    formatter={(v: number) => [`${v}%`]}
                    contentStyle={{ borderRadius: 12, border: "1px solid oklch(90% 0.02 264)", fontSize: 12 }}
                  />
                  <Bar dataKey="소진율" radius={[0, 6, 6, 0]}>
                    {deptChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.소진율 >= 80 ? "oklch(55% 0.22 25)" : "var(--color-primary)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">부서 데이터가 없습니다</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
