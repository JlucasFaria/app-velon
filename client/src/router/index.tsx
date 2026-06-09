import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { LoginPage } from "@/pages/auth/LoginPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";

/**
 * Guards authenticated routes. Redirects to /login when no access token is
 * present. Tokens live in localStorage (see AuthContext / api client).
 */
function ProtectedRoute() {
  const token = localStorage.getItem("accessToken");
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Authenticated area */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardPage />} />
        </Route>

        {/* Unknown paths fall back to the dashboard (which itself guards auth) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
