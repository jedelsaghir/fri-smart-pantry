import { useState } from "react";
import { toast } from "sonner";

interface LoginScreenProps {
  onLogin: () => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (mode === "signup" && !name)) {
      toast.error("Please fill out all fields");
      return;
    }
    // Fake auth
    const displayName = mode === "signup" ? name : email.split("@")[0];
    toast.success(mode === "signup" ? "Account created" : "Signed in", {
      description: `Welcome${mode === "signup" ? ", " + displayName : ""}!`,
    });
    onLogin();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background px-5 pt-[max(3rem,env(safe-area-inset-top))]">
      <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🥛</div>
          <h1 className="font-display text-[36px] tracking-[-0.02em] font-medium">Friġġ</h1>
          <p className="text-muted-foreground mt-1">Your calm family pantry</p>
        </div>

        <div className="w-full">
          <div className="flex gap-1 mb-6 rounded-3xl bg-secondary/60 p-1">
            <button
              onClick={() => setMode("signin")}
              className={`flex-1 rounded-2xl py-2 text-sm font-semibold transition ${mode === "signin" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-2xl py-2 text-sm font-semibold transition ${mode === "signup" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Borg"
                  className="w-full rounded-2xl bg-card border border-border/50 px-4 py-3 text-sm focus:outline-none focus:border-border"
                />
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@family.com"
                className="w-full rounded-2xl bg-card border border-border/50 px-4 py-3 text-sm focus:outline-none focus:border-border"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-2xl bg-card border border-border/50 px-4 py-3 text-sm focus:outline-none focus:border-border"
              />
            </div>

            <button
              type="submit"
              className="w-full mt-4 rounded-3xl bg-brand py-3.5 text-sm font-semibold text-brand-foreground active:scale-[0.985] transition"
            >
              {mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <p className="text-center text-[11px] text-muted-foreground mt-6">
            {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-foreground underline"
            >
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </p>
        </div>
      </div>

      <div className="text-center text-[10px] text-muted-foreground pb-8">
        Demo mode • No real data stored
      </div>
    </div>
  );
}
