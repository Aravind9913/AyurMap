import { useUser, useClerk, SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";
import { useEffect } from "react";

export default function Admin() {
  const { user } = useUser();
  const { signOut } = useClerk();

  useEffect(() => {
    // Auto-redirect logic will be handled on landing; this is a simple placeholder
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-secondary to-background">
      <div className="max-w-2xl text-center space-y-4 p-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage farmers, users & plants. Full UI coming next.</p>
        <SignedIn>
          <div className="text-sm text-muted-foreground">Signed in as {user?.primaryEmailAddress?.emailAddress}</div>
          <button className="mt-4 inline-flex items-center rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90" onClick={() => signOut()}>Logout</button>
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            <button className="mt-4 inline-flex items-center rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90">Sign in</button>
          </SignInButton>
        </SignedOut>
      </div>
    </div>
  );
}
