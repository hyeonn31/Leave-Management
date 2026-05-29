import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  BarChart3,
  Bell,
  CalendarCheck,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  Gift,
  Home,
  LogOut,
  Settings,
  Shield,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";

/* ─── Types ────────────────────────────────────────────────────────────────── */
interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "대시보드", href: "/", icon: <Home size={16} /> },
  { label: "연차 신청", href: "/leave/request", icon: <CalendarDays size={16} />, adminOnly: false },
  { label: "연차 이력", href: "/leave/history", icon: <CalendarCheck size={16} />, adminOnly: false },
  { label: "알림", href: "/notifications", icon: <Bell size={16} /> },
  { label: "내 프로필", href: "/profile", icon: <Settings size={16} /> },
  { label: "팀 연차 승인", href: "/team/approval", icon: <CheckSquare size={16} /> },
];

// Items hidden from admin users (admin has no personal leave)
const EMPLOYEE_ONLY_HREFS = ["/leave/request", "/leave/history"];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: "관리자 대시보드", href: "/admin", icon: <BarChart3 size={16} />, adminOnly: true },
  { label: "연차 신청 관리", href: "/admin/requests", icon: <ClipboardList size={16} />, adminOnly: true },
  { label: "직원 현황", href: "/admin/leave-overview", icon: <CalendarCheck size={16} />, adminOnly: true },
  { label: "특별 연차 부여", href: "/admin/special-leave", icon: <Gift size={16} />, adminOnly: true },
  { label: "직원 관리", href: "/admin/employees", icon: <Users size={16} />, adminOnly: true },
  { label: "통계 & 내보내기", href: "/admin/stats", icon: <BarChart3 size={16} />, adminOnly: true },
  { label: "팀 관리", href: "/admin/teams", icon: <Users size={16} />, adminOnly: true },
];

/* ─── Sidebar ──────────────────────────────────────────────────────────────── */
function Sidebar({
  user,
  isAdmin,
  unreadCount,
  onClose,
}: {
  user: { name?: string | null; email?: string | null };
  isAdmin: boolean;
  unreadCount: number;
  onClose?: () => void;
}) {
  const [location] = useLocation();
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => (window.location.href = "/"),
  });

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  return (
    <aside
      className="flex flex-col h-full w-64 shrink-0"
      style={{ background: "var(--color-sidebar)" }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ background: "var(--color-primary)" }}
          >
            HR
          </div>
          <span className="font-bold text-base" style={{ color: "var(--color-sidebar-foreground)" }}>
            연차 관리
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-lg hover:bg-sidebar-accent text-sidebar-muted"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* User card */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
            style={{ background: "var(--color-primary)" }}
          >
            {user.name?.charAt(0)?.toUpperCase() ?? "U"}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--color-sidebar-foreground)" }}>
              {user.name ?? "사용자"}
            </p>
            <p className="text-xs truncate" style={{ color: "var(--color-sidebar-muted)" }}>
              {user.email ?? ""}
            </p>
          </div>
          {isAdmin && (
            <span
              className="ml-auto shrink-0 px-1.5 py-0.5 rounded text-xs font-medium"
              style={{ background: "var(--color-primary)", color: "#fff" }}
            >
              관리자
            </span>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-sidebar-muted)" }}>
          메뉴
        </p>
        {NAV_ITEMS.filter((item) => !(isAdmin && EMPLOYEE_ONLY_HREFS.includes(item.href))).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className={`nav-item ${isActive(item.href) ? "active" : ""}`}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.href === "/notifications" && unreadCount > 0 && (
              <span
                className="ml-auto w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: "var(--color-primary)", color: "#fff" }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
        ))}

        {isAdmin && (
          <>
            <p className="px-3 pt-4 pb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-sidebar-muted)" }}>
              관리자
            </p>
            {ADMIN_NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`nav-item ${isActive(item.href) ? "active" : ""}`}
              >
                <Shield size={14} className="shrink-0 opacity-60" />
                <span>{item.label}</span>
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <button
          onClick={() => logout.mutate()}
          className="nav-item w-full text-left"
          disabled={logout.isPending}
        >
          <LogOut size={16} />
          <span>{logout.isPending ? "로그아웃 중…" : "로그아웃"}</span>
        </button>
      </div>
    </aside>
  );
}

/* ─── Header ───────────────────────────────────────────────────────────────── */
function Header({
  title,
  subtitle,
  unreadCount,
  onMenuToggle,
}: {
  title: string;
  subtitle?: string;
  unreadCount: number;
  onMenuToggle: () => void;
}) {
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-card border-b border-border shrink-0">
      {/* Mobile menu toggle */}
      <button
        className="lg:hidden p-2 rounded-xl hover:bg-muted mr-3"
        onClick={onMenuToggle}
      >
        <div className="w-5 h-0.5 bg-foreground mb-1 rounded" />
        <div className="w-5 h-0.5 bg-foreground mb-1 rounded" />
        <div className="w-5 h-0.5 bg-foreground rounded" />
      </button>

      <div>
        <h1 className="text-lg font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <Link
          href="/notifications"
          className="relative p-2 rounded-xl hover:bg-muted transition-colors"
          style={{ display: "inline-flex" }}
        >
          <Bell size={18} className="text-muted-foreground" />
          {unreadCount > 0 && (
            <span
              className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: "var(--color-primary)", fontSize: "9px" }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}

/* ─── Page title map ───────────────────────────────────────────────────────── */
const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "대시보드", subtitle: "연차 현황을 한눈에 확인하세요" },
  "/leave/request": { title: "연차 신청", subtitle: "새 연차를 신청하세요" },
  "/leave/history": { title: "연차 이력", subtitle: "연도별 연차 사용 내역" },
  "/notifications": { title: "알림", subtitle: "최근 알림 목록" },
  "/profile": { title: "내 프로필", subtitle: "프로필 및 직원 정보 관리" },
  "/admin": { title: "관리자 대시보드", subtitle: "전직원 연차 현황 요약" },
  "/admin/requests": { title: "연차 신청 관리", subtitle: "신청 승인 및 반려 처리" },
  "/admin/leave-overview": { title: "직원 연차 현황", subtitle: "직원별 잔여·사용 이력 조회" },
  "/admin/special-leave": { title: "특별 연차 부여", subtitle: "주말 출근자 보상 연차 부여" },
  "/admin/employees": { title: "직원 관리", subtitle: "직원 정보 및 입사일 관리" },
  "/admin/stats": { title: "통계 & 내보내기", subtitle: "연차 통계 및 CSV 내보내기" },
};

/* ─── Main Layout ──────────────────────────────────────────────────────────── */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === "admin";

  const { data: notifData } = trpc.notification.list.useQuery(
    undefined,
    { enabled: isAuthenticated, refetchInterval: 30000 }
  );
  const unreadCount = notifData?.filter((n: any) => !n.isRead).length ?? 0;

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  const pageInfo = PAGE_TITLES[location] ?? { title: "연차 관리", subtitle: "" };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
            style={{ background: "var(--color-primary)" }}
          >
            HR
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full animate-bounce"
                style={{
                  background: "var(--color-primary)",
                  animationDelay: `${i * 120}ms`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <div className="bg-card rounded-3xl p-8 shadow-card text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-6"
              style={{ background: "var(--color-primary)" }}
            >
              HR
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-1">연차 관리 시스템</h1>
            <p className="text-sm text-muted-foreground mb-8">HR 업무 전반을 하나의 플랫폼에서 처리하세요.</p>
            <a
              href={getLoginUrl()}
              className="btn-primary w-full justify-center py-3 text-base"
              style={{ display: "flex" }}
            >
              로그인
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — desktop always visible, mobile slide-in */}
      <div
        className={`
          fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
          transform transition-transform duration-250 ease-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
        style={{ transitionTimingFunction: "var(--ease-out)" }}
      >
        <Sidebar
          user={user!}
          isAdmin={isAdmin}
          unreadCount={unreadCount}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          title={pageInfo.title}
          subtitle={pageInfo.subtitle}
          unreadCount={unreadCount}
          onMenuToggle={() => setSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="p-6 animate-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
