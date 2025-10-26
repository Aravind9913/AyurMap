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
    if (email === import.meta.env.VITE_ADMIN_EMAIL) {
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
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="text-foreground/70 font-medium">Loading...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-light">
      <main className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="mx-auto max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground mb-2">
              AyurMap
            </h1>
            <p className="text-sm text-muted-foreground">
              Ayurvedic plants at your fingertips
            </p>
          </div>

          <Button
            size="lg"
            className="w-full h-12 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium transition-colors"
            onClick={() => setOpenRoleModal(true)}
          >
            Get Started
          </Button>
        </div>

        <footer className="absolute bottom-6 left-0 right-0 text-center text-xs text-muted-foreground">
          © AyurMap
        </footer>
      </main>

      <Dialog open={openRoleModal} onOpenChange={setOpenRoleModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-medium text-foreground">Choose your role</DialogTitle>
          </DialogHeader>
          {!showAuth ? (
            <div className="space-y-2">
              <button
                onClick={() => handleSelectRole("Farmer")}
                className="w-full rounded-lg border border-border bg-card p-4 text-left hover:bg-secondary transition"
              >
                <div className="text-2xl mb-2">🌿</div>
                <div className="font-medium text-foreground">Farmer</div>
                <div className="text-xs text-muted-foreground mt-1">Upload & manage plants</div>
              </button>
              <button
                onClick={() => handleSelectRole("Consumer")}
                className="w-full rounded-lg border border-border bg-card p-4 text-left hover:bg-secondary transition"
              >
                <div className="text-2xl mb-2">🌼</div>
                <div className="font-medium text-foreground">Consumer</div>
                <div className="text-xs text-muted-foreground mt-1">Explore plants near you</div>
              </button>
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-auto px-1">
              <SignIn
                routing="virtual"
                appearance={{
                  variables: {
                    colorPrimary: "#2F6B3D",
                    colorText: "#1E1E1E",
                    colorInputBackground: "#ffffff",
                  },
                  elements: {
                    card: "shadow-none border border-border",
                    headerTitle: "text-foreground font-medium",
                    headerSubtitle: "text-muted-foreground text-sm",
                    formButtonPrimary: "bg-primary hover:bg-primary/90",
                    socialButtonsBlockButton: "border border-border hover:bg-secondary",
                  },
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
