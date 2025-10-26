import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SignIn, useUser, useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";

type Role = "Farmer" | "Consumer";

function Leaf({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M100 10C60 30 30 60 20 100c10 40 40 70 80 80 40-10 70-40 80-80C170 60 140 30 100 10z"
        fill="currentColor"
        opacity="0.15"
      />
      <path
        d="M100 35c-22 12-42 32-50 50 8 22 28 42 50 50 22-8 42-28 50-50-8-18-28-38-50-50z"
        fill="currentColor"
        opacity="0.22"
      />
    </svg>
  );
}

export default function Index() {
  const [openRoleModal, setOpenRoleModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [roleSynced, setRoleSynced] = useState(false);
  const navigate = useNavigate();
  const { user, isSignedIn, isLoaded } = useUser();
  const { getToken } = useAuth();

  // Wait for Clerk to fully load AND sync role before navigating
  useEffect(() => {
    // Only proceed if Clerk is loaded, user is signed in, and we have user data
    if (!isLoaded || !isSignedIn || !user || isNavigating) return;

    const email = user.primaryEmailAddress?.emailAddress ?? "";
    const storedRole = (localStorage.getItem("ayurmap_role") as Role | null) || selectedRole;

    // Only navigate if role is synced or we don't need to sync
    if (!roleSynced && storedRole) return;

    setIsNavigating(true);

    // Navigate immediately
    if (email === "aravindsrksrk1399@gmail.com") {
      navigate("/admin", { replace: true });
      return;
    }

    if (storedRole === "Farmer") {
      navigate("/farmer", { replace: true });
    } else if (storedRole === "Consumer") {
      navigate("/user", { replace: true });
    }
  }, [isLoaded, isSignedIn, user, selectedRole, navigate, isNavigating, roleSynced]);

  const gradients = useMemo(
    () => (
      <>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,hsl(var(--accent)/0.20),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(40%_40%_at_100%_100%,hsl(var(--primary)/0.18),transparent_60%)]" />
      </>
    ),
    [],
  );

  const handleSelectRole = (role: Role) => {
    setSelectedRole(role);
    localStorage.setItem("ayurmap_role", role);
    setShowAuth(true);
  };

  // Sync role to backend after sign-in and mark as synced
  useEffect(() => {
    const syncRoleToBackend = async () => {
      if (!isLoaded || !isSignedIn || !user) return;

      const storedRole = localStorage.getItem("ayurmap_role") as Role | null;
      if (!storedRole) {
        setRoleSynced(true); // No role to sync, allow navigation
        return;
      }

      try {
        const token = await getToken();
        const backendRole = storedRole === "Farmer" ? "farmer" : "consumer";

        const response = await fetch("http://localhost:5000/api/user/sync-role", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ role: backendRole })
        });

        if (response.ok) {
          console.log("✅ Role synced to backend:", backendRole);
          setRoleSynced(true); // Mark as synced to allow navigation
        } else {
          console.error("❌ Failed to sync role:", await response.text());
          setRoleSynced(true); // Still allow navigation even if sync fails
        }
      } catch (error) {
        console.error("❌ Role sync error:", error);
        setRoleSynced(true); // Still allow navigation even if sync fails
      }
    };

    syncRoleToBackend();
  }, [isLoaded, isSignedIn, user, getToken]);

  // Show loading screen if Clerk is not loaded OR during navigation OR waiting for role sync
  if (!isLoaded || isNavigating || (isSignedIn && user && !roleSynced && localStorage.getItem("ayurmap_role"))) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-secondary to-background">
        {gradients}
        <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent"></div>
            <p className="text-emerald-900/70 font-medium">Loading...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-secondary to-background">
      {gradients}

      {/* Floating leaves */}
      <Leaf className="absolute -left-10 top-24 h-36 w-36 text-primary/40 animate-float-slow" />
      <Leaf className="absolute right-10 top-10 h-24 w-24 text-accent/40 animate-float" />
      <Leaf className="absolute -right-8 bottom-16 h-40 w-40 text-primary/30 animate-float" />

      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6">
        <div className="mx-auto max-w-3xl text-center animate-fade-in-up">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-emerald-800 shadow-sm ring-1 ring-emerald-200 backdrop-blur">
            AI-Powered Ayurvedic Plant Locator
          </div>
          <h1 className="mt-6 text-5xl font-extrabold tracking-tight text-emerald-900 md:text-6xl">
            AyurMap
          </h1>
          <p className="mt-4 text-2xl font-semibold text-emerald-900/90">
            🪴 Grow the Cure — Ayurvedic Healing, Mapped
          </p>
          <p className="mt-3 text-base leading-relaxed text-emerald-900/70">
            Discover Ayurvedic plants, connect with farmers, and explore natural remedies near you.
          </p>

          <div className="mt-10">
            <Button
              size="lg"
              className="group h-12 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-500 px-8 text-base font-semibold text-white shadow-lg shadow-emerald-500/20 transition-transform duration-200 hover:scale-[1.03] focus-visible:scale-[1.03]"
              onClick={() => setOpenRoleModal(true)}
            >
              <span className="relative">
                <span className="absolute inset-0 -z-10 bg-[linear-gradient(110deg,rgba(255,255,255,0)_40%,rgba(255,255,255,.6)_50%,rgba(255,255,255,0)_60%)] bg-[length:200%_100%] opacity-40 transition group-hover:animate-shine" />
                Get Started
              </span>
            </Button>
          </div>
        </div>

        <footer className="absolute bottom-6 left-0 right-0 z-10 mx-auto w-full px-6 text-center text-sm text-emerald-900/70">
          © AyurMap — AI-Powered Ayurvedic Plant Locator.
        </footer>
      </main>

      <Dialog open={openRoleModal} onOpenChange={setOpenRoleModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Choose your role</DialogTitle>
          </DialogHeader>
          {!showAuth ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleSelectRole("Farmer")}
                className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-emerald-800 shadow-sm transition hover:bg-emerald-100"
              >
                <div className="text-3xl">🌿</div>
                <div className="mt-2 font-semibold">Farmer</div>
                <div className="text-xs text-emerald-800/70">Upload & manage plants</div>
              </button>
              <button
                onClick={() => handleSelectRole("Consumer")}
                className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-emerald-800 shadow-sm transition hover:bg-emerald-100"
              >
                <div className="text-3xl">🌼</div>
                <div className="mt-2 font-semibold">Consumer</div>
                <div className="text-xs text-emerald-800/70">Explore plants near you</div>
              </button>
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-auto px-1">
              <SignIn
                routing="virtual"
                appearance={{
                  variables: {
                    colorPrimary: "#059669",
                    colorText: "#064e3b",
                    colorInputBackground: "#ffffff",
                  },
                }}
              />
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Continue with Google or sign in with Email
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
