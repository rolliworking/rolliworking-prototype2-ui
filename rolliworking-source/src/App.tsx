import { useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { toast } from "sonner";

import { AuthProvider } from "@/components/auth/AuthProvider";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AppShell } from "@/components/app/AppShell";
import { protectedRoutes, ProtectedRoute } from "@/config/routes";

import Login from "./pages/Login";
import SignWaiver from "./pages/SignWaiver";
import ApproveInspection from "./pages/ApproveInspection";
import ApprovePartsRequest from "./pages/ApprovePartsRequest";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => {
  // Global handler for unhandled promise rejections (e.g., dynamic import failures)
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      const message = event.reason?.message || String(event.reason);
      
      // Check if it's a dynamic import failure
      if (message.includes("Failed to fetch dynamically imported module")) {
        console.error("Dynamic import failed:", event.reason);
        event.preventDefault();
        
        // Show user-friendly error and offer refresh
        toast.error("Failed to load page. Refreshing...", {
          duration: 2000,
        });
        
        // Auto-refresh after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    };

    window.addEventListener("unhandledrejection", handleRejection);
    return () => window.removeEventListener("unhandledrejection", handleRejection);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/sign-waiver" element={<SignWaiver />} />
              <Route path="/waiver/:waiverNumber" element={<SignWaiver />} />
              <Route path="/approve-inspection" element={<ApproveInspection />} />
              <Route path="/approve-parts" element={<ApprovePartsRequest />} />
              <Route path="/waiver/:waiverNumber" element={<SignWaiver />} />

              {/* Protected routes */}
              <Route element={<RequireAuth />}>
                <Route element={<AppShell />}>
                  {protectedRoutes.map((route) => (
                    <Route
                      key={route.path}
                      path={route.path}
                      element={<ProtectedRoute route={route} />}
                    />
                  ))}
                </Route>
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
