import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
} from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { ClientsPage } from "@/pages/clients/ClientsPage";
import { ClientDetailPage } from "@/pages/clients/ClientDetailPage";
import { OrdersPage } from "@/pages/orders/OrdersPage";
import { OrderDetailPage } from "@/pages/orders/OrderDetailPage";
import { ReceiptPage } from "@/pages/receipts/ReceiptPage";
import { ReportsPage } from "@/pages/reports/ReportsPage";
import { ProfilePage } from "@/pages/profile/ProfilePage";

function ProtectedRoute() {
  const { accessToken } = useAuth();
  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  {
    // Authenticated area
    element: <ProtectedRoute />,
    children: [
      { path: "/", element: <DashboardPage /> },
      { path: "/clients", element: <ClientsPage /> },
      { path: "/clients/:id", element: <ClientDetailPage /> },
      { path: "/orders", element: <OrdersPage /> },
      { path: "/orders/:id", element: <OrderDetailPage /> },
      { path: "/orders/:id/receipt", element: <ReceiptPage /> },
      { path: "/reports", element: <ReportsPage /> },
      { path: "/profile", element: <ProfilePage /> },
    ],
  },
  // Unknown paths fall back to the dashboard (which itself guards auth)
  { path: "*", element: <Navigate to="/" replace /> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
