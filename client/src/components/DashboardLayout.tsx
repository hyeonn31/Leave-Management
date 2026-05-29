import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Settings,
  User,
  Users,
  Gift,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { trpc } from "@/lib/trpc";

const employeeMenuItems = [
  { icon: LayoutDashboard, label: "대시보드", path: "/" },
  { icon: CalendarDays, label: "연차 신청", path: "/leave/request" },
  { icon: ClipboardList, label: "내 연차 내역", path: "/leave/history" },
  { icon: Bell, label: "알림", path: "/notifications" },
  { icon: User, label: "내 프로필", path: "/profile" },
];

const adminMenuItems = [
  { icon: LayoutDashboard, label: "관리자 대시보드", path: "/admin" },
  { icon: ClipboardList, label: "연차 신청 관리", path: "/admin/requests" },
  { icon: Users, label: "직원 관리", path: "/admin/employees" },
  { icon: CalendarDays, label: "직원별 연차 현황", path: "/admin/leave-overview" },
  { icon: Gift, label: "특별 연차 부여", path: "/admin/special-leave" },
  { icon: BarChart3, label: "통계 & 내보내기", path: "/admin/stats" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 200;
const MAX_WIDTH = 360;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-sm w-full px-8">
          {/* ITS: big red square accent */}
          <div className="w-12 h-12 bg-red-accent mb-8" />
          <h1 className="text-3xl font-black tracking-tight mb-2">연차 관리 시스템</h1>
          <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
            HR 업무 전반을 하나의 플랫폼에서 처리하세요.
            <br />
            로그인이 필요합니다.
          </p>
          <div className="its-rule mb-8" />
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            className="w-full h-12 text-sm font-semibold tracking-widest uppercase btn-press"
          >
            로그인
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  setSidebarWidth: (w: number) => void;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isAdmin = user?.role === "admin";

  const { data: unreadCount } = trpc.notification.unreadCount.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const menuItems = isAdmin
    ? [...employeeMenuItems, ...adminMenuItems]
    : employeeMenuItems;

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r border-border bg-sidebar" disableTransition={isResizing}>
          {/* Header */}
          <SidebarHeader className="h-14 border-b border-border px-3 flex-row items-center gap-2">
            <button
              onClick={toggleSidebar}
              className="h-8 w-8 flex items-center justify-center hover:bg-accent transition-colors focus:outline-none shrink-0"
              aria-label="Toggle navigation"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
            {!isCollapsed && (
              <div className="flex items-center gap-2 min-w-0 animate-fade-in">
                <div className="w-3 h-3 bg-red-accent shrink-0" />
                <span className="font-black text-sm tracking-widest uppercase truncate">
                  연차 관리
                </span>
              </div>
            )}
          </SidebarHeader>

          {/* Navigation */}
          <SidebarContent className="gap-0 pt-2">
            {/* Employee section */}
            {!isCollapsed && (
              <p className="px-4 py-2 text-[10px] font-mono font-medium uppercase tracking-widest text-muted-foreground">
                직원
              </p>
            )}
            <SidebarMenu className="px-2">
              {employeeMenuItems.map((item) => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-9 transition-colors font-normal relative ${
                        isActive
                          ? "bg-foreground text-background font-medium"
                          : "hover:bg-accent"
                      }`}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {item.path === "/notifications" && (unreadCount ?? 0) > 0 && (
                        <span className="ml-auto bg-red-accent text-white text-[10px] font-mono px-1.5 py-0.5 min-w-[18px] text-center">
                          {unreadCount}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            {/* Admin section */}
            {isAdmin && (
              <>
                {!isCollapsed && (
                  <p className="px-4 py-2 mt-2 text-[10px] font-mono font-medium uppercase tracking-widest text-red-accent">
                    관리자
                  </p>
                )}
                <SidebarMenu className="px-2">
                  {adminMenuItems.map((item) => {
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className={`h-9 transition-colors font-normal ${
                            isActive
                              ? "bg-red-accent text-white font-medium"
                              : "hover:bg-red-accent-light hover:text-red-accent"
                          }`}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </>
            )}
          </SidebarContent>

          {/* Footer */}
          <SidebarFooter className="p-3 border-t border-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 px-2 py-2 hover:bg-accent transition-colors w-full text-left focus:outline-none group-data-[collapsible=icon]:justify-center">
                  <Avatar className="h-8 w-8 border border-border shrink-0">
                    <AvatarFallback className="text-xs font-bold bg-foreground text-background">
                      {user?.name?.charAt(0).toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate leading-none">{user?.name || "-"}</p>
                      <p className="text-[10px] text-muted-foreground truncate mt-1 font-mono">
                        {isAdmin ? "관리자" : "직원"}
                      </p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setLocation("/profile")} className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>내 프로필</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>로그아웃</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Resize handle */}
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-foreground/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background px-4 sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-8 w-8" />
              <div className="w-2 h-2 bg-red-accent" />
              <span className="font-black text-sm tracking-widest uppercase">연차 관리</span>
            </div>
          </div>
        )}
        <main className="flex-1 min-h-screen">{children}</main>
      </SidebarInset>
    </>
  );
}
