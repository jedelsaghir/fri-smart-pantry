"use client";

import { useState } from "react";
import { toast } from "sonner";

interface LoginScreenProps {
  onLogin: () => void;
}

type OnboardStep = "welcome" | "household" | "profile";

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [householdName, setHouseholdName] = useState("The Borg Family");
  const [profileEmoji, setProfileEmoji] = useState("👩‍🍳");
  const [onboardStep, setOnboardStep] = useState<OnboardStep | null>(null);

  const emojiOptions = ["👩‍🍳", "👤", "🧑‍🌾", "👨‍🍳", "🌿"];

  const resetAuthForm = () => {
    setName("");
    setEmail("");
    setPassword("");
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (mode === "signup" && !name)) {
      toast.error("Please fill out all fields");
      return;
    }

    if (mode === "signin") {
      const display = email.split("@")[0];
      toast.success("Welcome back", { description: display });
      onLogin();
    } else {
      // Signup → beautiful onboarding
      setHouseholdName("The " + (name.split(" ")[1] || "Family") + " Home");
      setProfileEmoji("👩‍🍳");
      setOnboardStep("welcome");
    }
  };

  const completeOnboarding = () => {
    const displayName = name || email.split("@")[0];
    toast.success("All set!", {
      description: `Welcome to Friġġ, ${displayName.split(" ")[0]}.`,
    });
    // Persist a little onboarding data (demo)
    try {
      localStorage.setItem("friggg-household", householdName);
      localStorage.setItem("friggg-profile", JSON.stringify({ name: displayName, emoji: profileEmoji }));
    } catch {}
    setOnboardStep(null);
    resetAuthForm();
    onLogin();
  };

  // Onboarding screens (simple, calm, sequential)
  if (onboardStep) {
    return (
      <div className="min-h-screen flex flex-col bg-background px-5 pt-[max(2.5rem,env(safe-area-inset-top))]">
        <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
          {onboardStep === "welcome" && (
            <div className="text-center w-full">
              <div className="mx-auto mb-6 text-7xl">🥛</div>
              <h1 className="font-display text-[34px] tracking-[-0.02em] font-medium">Welcome to Friġġ</h1>
              <p className="mt-3 text-muted-foreground max-w-[260px] mx-auto">
                A calm space to know what’s in your kitchen — no stress, just clarity.
              </p>
              <button
                onClick={() => setOnboardStep("household")}
                className="mt-10 w-full rounded-3xl bg-brand py-3.5 text-sm font-semibold text-brand-foreground active:scale-[0.985] transition"
              >
                Get started
              </button>
              <button
                onClick={() => { setOnboardStep(null); resetAuthForm(); }}
                className="mt-3 text-sm text-muted-foreground underline"
              >
                Maybe later
              </button>
            </div>
          )}

          {onboardStep === "household" && (
            <div className="w-full">
              <div className="text-center mb-8">
                <div className="text-5xl mb-4">🏠</div>
                <h2 className="font-display text-2xl tracking-tight">Name your household</h2>
                <p className="text-muted-foreground mt-1 text-sm">This appears in the shared view.</p>
              </div>

              <input
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                className="w-full rounded-3xl bg-card border border-border/50 px-5 py-4 text-lg font-medium focus:outline-none focus:border-border text-center"
                placeholder="The Family"
              />

              <div className="mt-3 flex flex-wrap gap-2 justify-center">
                {["The Borg Family", "Smith Home", "Our Kitchen", "Green Household"].map((h, i) => (
                  <button
                    key={i}
                    onClick={() => setHouseholdName(h)}
                    className="text-xs rounded-full border px-3 py-1 active:bg-secondary"
                  >
                    {h}
                  </button>
                ))}
              </div>

              <div className="mt-8 flex gap-3">
                <button onClick={() => setOnboardStep("welcome")} className="flex-1 rounded-3xl border py-3 text-sm font-semibold active:bg-secondary/70">Back</button>
                <button onClick={() => setOnboardStep("profile")} className="flex-1 rounded-3xl bg-brand py-3 text-sm font-semibold text-brand-foreground active:scale-[0.985]">Continue</button>
              </div>
            </div>
          )}

          {onboardStep === "profile" && (
            <div className="w-full text-center">
              <div className="mb-6">
                <div className="text-6xl mb-3">{profileEmoji}</div>
                <h2 className="font-display text-2xl tracking-tight">Your profile</h2>
                <p className="text-muted-foreground mt-1 text-sm">Quick and personal.</p>
              </div>

              <div className="mb-6">
                <div className="text-xs text-muted-foreground mb-1.5 tracking-wider">DISPLAY NAME</div>
                <div className="text-xl font-semibold">{name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{email}</div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground mb-2 tracking-wider">PICK AN AVATAR</div>
                <div className="flex justify-center gap-3">
                  {emojiOptions.map((em) => (
                    <button
                      key={em}
                      onClick={() => setProfileEmoji(em)}
                      className={`text-3xl p-3 rounded-2xl transition active:scale-95 ${profileEmoji === em ? "bg-secondary ring-1 ring-border" : "opacity-70"}`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-10 flex gap-3">
                <button onClick={() => setOnboardStep("household")} className="flex-1 rounded-3xl border py-3 text-sm font-semibold active:bg-secondary/70">Back</button>
                <button onClick={completeOnboarding} className="flex-1 rounded-3xl bg-brand py-3 text-sm font-semibold text-brand-foreground active:scale-[0.985]">Finish setup</button>
              </div>
            </div>
          )}
        </div>

        <div className="text-center text-[10px] text-muted-foreground pb-8">All data stays on your device in this demo</div>
      </div>
    );
  }

  // Main calm auth screen
  return (
    <div className="min-h-screen flex flex-col bg-background px-5 pt-[max(3rem,env(safe-area-inset-top))]">
      <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
        <div className="text-center mb-9">
          <div className="mx-auto mb-4 text-6xl">🥛</div>
          <h1 className="font-display text-[38px] tracking-[-0.025em] font-medium">Friġġ</h1>
          <p className="text-muted-foreground mt-1.5 text-[15px]">Your calm family pantry</p>
        </div>

        <div className="w-full">
          {/* Premium segmented control */}
          <div className="flex gap-1 mb-7 rounded-3xl bg-secondary/60 p-1">
            <button
              onClick={() => { setMode("signin"); setOnboardStep(null); }}
              className={`flex-1 rounded-2xl py-2.5 text-sm font-semibold transition ${mode === "signin" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-2xl py-2.5 text-sm font-semibold transition ${mode === "signup" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="text-xs uppercase tracking-[1px] text-muted-foreground block mb-1.5 pl-0.5">Your name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Elena Borg"
                  className="w-full rounded-3xl bg-card border border-border/50 px-5 py-3.5 text-[15px] focus:outline-none focus:border-border/80"
                />
              </div>
            )}
            <div>
              <label className="text-xs uppercase tracking-[1px] text-muted-foreground block mb-1.5 pl-0.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@family.com"
                className="w-full rounded-3xl bg-card border border-border/50 px-5 py-3.5 text-[15px] focus:outline-none focus:border-border/80"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[1px] text-muted-foreground block mb-1.5 pl-0.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-3xl bg-card border border-border/50 px-5 py-3.5 text-[15px] focus:outline-none focus:border-border/80"
              />
            </div>

            <button
              type="submit"
              className="w-full mt-5 rounded-3xl bg-brand py-3.5 text-[15px] font-semibold text-brand-foreground active:scale-[0.985] active:brightness-105 transition"
            >
              {mode === "signin" ? "Sign in" : "Create account & continue"}
            </button>
          </form>

          <p className="text-center text-[11px] text-muted-foreground mt-7">
            {mode === "signin" ? "New here?" : "Have an account?"}{" "}
            <button
              onClick={() => {
                const next = mode === "signin" ? "signup" : "signin";
                setMode(next);
              }}
              className="text-foreground underline underline-offset-2"
            >
              {mode === "signin" ? "Create an account" : "Sign in instead"}
            </button>
          </p>
        </div>
      </div>

      <div className="text-center text-[10px] text-muted-foreground pb-8">
        Demo • Everything stays private on your device
      </div>
    </div>
  );
}
