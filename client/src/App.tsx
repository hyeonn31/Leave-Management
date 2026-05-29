import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
// Pages
import Home from "./pages/Home";
import LeaveRequest from "./pages/LeaveRequest";
import LeaveHistory from "./pages/LeaveHistory";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/AdminDashboard";
import AdminRequests from "./pages/AdminRequests";
import AdminEmployees from "./pages/AdminEmployees";
import AdminStats from "@/pages/AdminStats";
import AdminLeaveOverview from "@/pages/AdminLeaveOverview";
import AdminSpecialLeave from "@/pages/AdminSpecialLeave";

function Router() {
  return (
    <Switch>
        <Route path="/" component={Home} />
        <Route path="/leave/request" component={LeaveRequest} />
        <Route path="/leave/history" component={LeaveHistory} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/profile" component={Profile} />
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/admin/requests" component={AdminRequests} />
        <Route path="/admin/employees" component={AdminEmployees} />
        <Route path="/admin/stats" component={AdminStats} />
        <Route path="/admin/leave-overview" component={AdminLeaveOverview} />
        <Route path="/admin/special-leave" component={AdminSpecialLeave} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
