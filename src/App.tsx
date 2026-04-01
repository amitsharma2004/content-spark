import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { AppLayout } from "./components/AppLayout";
import Index from "./pages/Index";
import Generate from "./pages/Generate";
import CalendarView from "./pages/CalendarView";
import Queue from "./pages/Queue";
import History from "./pages/History";
import Analytics from "./pages/Analytics";
import BrandProfile from "./pages/BrandProfile";
import TeamManagement from "./pages/TeamManagement";
import Kanban from "./pages/Kanban";
import RagDataset from "./pages/RagDataset";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Index />} />
        <Route path="generate" element={<Generate />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="calendar" element={<CalendarView />} />
        <Route path="queue" element={<Queue />} />
        <Route path="history" element={<History />} />
        <Route path="brand" element={<BrandProfile />} />
        <Route path="team" element={<TeamManagement />} />
        <Route path="kanban" element={<Kanban />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Auth />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
