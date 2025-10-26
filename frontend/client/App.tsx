import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import Farmer from "./pages/Farmer";
import User from "./pages/User";
import { ClerkProvider } from "@clerk/clerk-react";

const queryClient = new QueryClient();
const clerkPk = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string) || "pk_test_Y2xpbWJpbmctbWFybW90LTE4LmNsZXJrLmFjY291bnRzLmRldiQ";

const App = () => (
  <ClerkProvider publishableKey={clerkPk}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/farmer" element={<Farmer />} />
            <Route path="/user" element={<User />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ClerkProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
