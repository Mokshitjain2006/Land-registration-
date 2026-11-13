import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { WalletProvider } from "./context/WalletContext";
import { WalletModal } from "./components/WalletModal";
import { LandingPage } from "./pages/LandingPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { RegisterLandPage } from "./pages/RegisterLandPage";
import { OwnerDashboardPage } from "./pages/OwnerDashboardPage";
import { VerifyPropertyPage } from "./pages/VerifyPropertyPage";
import { TransactionHistoryPage } from "./pages/TransactionHistoryPage";
import { ExploreRegistryPage } from "./pages/ExploreRegistryPage";

export default function App() {
  return (
    <BrowserRouter>
      <WalletProvider>
        <Toaster position="bottom-right" richColors />
        <WalletModal />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/registry" element={<ExploreRegistryPage />} />
          <Route path="/verify" element={<VerifyPropertyPage />} />
          <Route path="/verify/:propertyId" element={<VerifyPropertyPage />} />
          <Route path="/owner" element={<OwnerDashboardPage />} />
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/register" element={<RegisterLandPage />} />
          <Route path="/transactions" element={<TransactionHistoryPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </WalletProvider>
    </BrowserRouter>
  );
}
