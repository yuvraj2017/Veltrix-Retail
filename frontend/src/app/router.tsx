import { createBrowserRouter } from "react-router-dom";

import BillingPage from "../pages/BillingPage";
import DashboardPage from "../pages/DashboardPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import LoginPage from "../pages/LoginPage";
import ProductsPage from "../pages/ProductsPage";
import RegisterPage from "../pages/RegisterPage";
import ReportsPage from "../pages/ReportsPage";
import SettingsPage from "../pages/SettingsPage";
import AddProductPage from "../pages/AddProductPage";
import ProfilePage from "../pages/ProfilePage";

import VendorsPage from "../pages/VendorsPage";
import AddVendorPage from "../pages/AddVendorPage";
import VendorDetailsPage from "../pages/VendorDetailsPage";
import AddVendorBillPage from "../pages/AddVendorBillPage";

import { ProtectedRoute } from "../routes/ProtectedRoute";
import { PublicOnlyRoute } from "../routes/PublicOnlyRoute";

export const router = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: "/", element: <LoginPage /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      { path: "/forgot-password", element: <ForgotPasswordPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      { path: "/dashboard", element: <DashboardPage /> },

      { path: "/products", element: <ProductsPage /> },
      { path: "/products/new", element: <AddProductPage /> },

      { path: "/vendors", element: <VendorsPage /> },
      { path: "/vendors/new", element: <AddVendorPage /> },
      { path: "/vendors/:vendorId", element: <VendorDetailsPage /> },
      { path: "/vendors/:vendorId/bills/new", element: <AddVendorBillPage /> },

      { path: "/billing", element: <BillingPage /> },
      { path: "/reports", element: <ReportsPage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "/profile", element: <ProfilePage /> },
    ],
  },
]);