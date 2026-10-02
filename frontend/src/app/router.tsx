import { Suspense, lazy, type ReactNode } from "react";
import { createBrowserRouter } from "react-router-dom";

// LoginPage stays eagerly imported: it is the landing route ("/") and therefore
// the first-paint / LCP path. Lazy-loading it would add a round trip before the
// login form can render. Every other route is split into its own chunk.
import LoginPage from "../pages/LoginPage";

import { PublicRouteFallback } from "../components/layout/RouteFallback";
import { ProtectedLayout } from "../routes/ProtectedLayout";
import { ProtectedRoute } from "../routes/ProtectedRoute";
import { AdminRoute } from "../routes/AdminRoute";
import { ShopOwnerRoute } from "../routes/ShopOwnerRoute";
import { PublicOnlyRoute } from "../routes/PublicOnlyRoute";

/* ---------------------------------------------------------------- *
 * Lazy route chunks
 * ---------------------------------------------------------------- */

const RegisterPage = lazy(() => import("../pages/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("../pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("../pages/ResetPasswordPage"));

const DashboardPage = lazy(() => import("../pages/DashboardPage"));

const ProductsPage = lazy(() => import("../pages/ProductsPage"));
const AddProductPage = lazy(() => import("../pages/AddProductPage"));

const VendorsPage = lazy(() => import("../pages/VendorsPage"));
const AddVendorPage = lazy(() => import("../pages/AddVendorPage"));
const VendorDetailsPage = lazy(() => import("../pages/VendorDetailsPage"));
const AddVendorBillPage = lazy(() => import("../pages/AddVendorBillPage"));
const PurchaseOrdersPage = lazy(() => import("../pages/PurchaseOrdersPage"));
const InventoryPage = lazy(() => import("../pages/InventoryPage"));

const BillingPage = lazy(() => import("../pages/BillingPage"));
const CreateInvoicePage = lazy(() => import("../pages/CreateInvoicePage"));
const InvoicePreviewPage = lazy(() => import("../pages/InvoicePreviewPage"));

const ExpensesPage = lazy(() => import("../pages/ExpensesPage"));

// Named exports need to be mapped onto `default` for React.lazy.
const CustomersPage = lazy(() =>
  import("../pages/CustomersPage").then((m) => ({ default: m.CustomersPage }))
);
const CustomerDetailsPage = lazy(() =>
  import("../pages/CustomerDetailsPage").then((m) => ({ default: m.CustomerDetailsPage }))
);

const ReportsPage = lazy(() => import("../pages/ReportsPage"));
const SubscriptionPage = lazy(() => import("../pages/SubscriptionPage"));

// Super Admin. Lazy like every other non-landing route, so the chunk is
// never downloaded by a regular user who cannot reach these screens.
const AdminDashboardPage = lazy(() => import("../pages/admin/AdminDashboardPage"));
const AdminUsersPage = lazy(() => import("../pages/admin/AdminUsersPage"));
const AdminUserDetailsPage = lazy(
  () => import("../pages/admin/AdminUserDetailsPage")
);
const AdminAuditLogsPage = lazy(() => import("../pages/admin/AdminAuditLogsPage"));
const AdminPlansPage = lazy(() => import("../pages/admin/AdminPlansPage"));
const SettingsPage = lazy(() => import("../pages/SettingsPage"));
const ProfilePage = lazy(() => import("../pages/ProfilePage"));

/* ---------------------------------------------------------------- *
 * Suspense helpers
 * ---------------------------------------------------------------- */

/** Public routes render standalone, so they get a full-viewport skeleton. */
const publicRoute = (node: ReactNode) => (
  <Suspense fallback={<PublicRouteFallback />}>{node}</Suspense>
);

/**
 * Protected routes render inside AppShell. ProtectedLayout owns the Suspense
 * boundary around <Outlet />, so the sidebar and header stay mounted and
 * interactive while the next page chunk downloads.
 */

export const router = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: "/", element: <LoginPage /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: publicRoute(<RegisterPage />) },
      { path: "/forgot-password", element: publicRoute(<ForgotPasswordPage />) },
      { path: "/reset-password", element: publicRoute(<ResetPasswordPage />) },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <ProtectedLayout />,
        children: [
          // Shop-owner area. A super admin has no shop, so ShopOwnerRoute
          // sends them to /admin instead of letting them hit routes whose
          // every request the backend would refuse.
          {
            element: <ShopOwnerRoute />,
            children: [
          { path: "/dashboard", element: <DashboardPage /> },

          { path: "/products", element: <ProductsPage /> },
          { path: "/products/new", element: <AddProductPage /> },

          { path: "/vendors", element: <VendorsPage /> },
          { path: "/vendors/new", element: <AddVendorPage /> },
          { path: "/vendors/:vendorId", element: <VendorDetailsPage /> },
          { path: "/vendors/:vendorId/bills/new", element: <AddVendorBillPage /> },
          { path: "/vendors/:vendorId/bills/:billId/edit", element: <AddVendorBillPage /> },
          { path: "/purchase-orders", element: <PurchaseOrdersPage /> },
          { path: "/inventory", element: <InventoryPage /> },

          { path: "/billing", element: <BillingPage /> },
          { path: "/billing/new", element: <CreateInvoicePage /> },
          { path: "/billing/:invoiceId/preview", element: <InvoicePreviewPage /> },

          { path: "/expenses", element: <ExpensesPage /> },

          { path: "/customers", element: <CustomersPage /> },
          { path: "/customers/:customerId", element: <CustomerDetailsPage /> },

          { path: "/reports", element: <ReportsPage /> },
          { path: "/subscription", element: <SubscriptionPage /> },
          { path: "/settings", element: <SettingsPage /> },
            ],
          },

          // Shared: an administrator still has their own account to manage.
          { path: "/profile", element: <ProfilePage /> },

          // Super Admin. AdminRoute nests inside ProtectedLayout so these
          // screens keep the same shell, sidebar and Suspense boundary as
          // the rest of the app. The guard is UX layering -- authorisation
          // is enforced by require_super_admin on every admin endpoint.
          {
            element: <AdminRoute />,
            children: [
              { path: "/admin", element: <AdminDashboardPage /> },
              { path: "/admin/users", element: <AdminUsersPage /> },
              { path: "/admin/users/:userId", element: <AdminUserDetailsPage /> },
              { path: "/admin/plans", element: <AdminPlansPage /> },
              { path: "/admin/audit-logs", element: <AdminAuditLogsPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
