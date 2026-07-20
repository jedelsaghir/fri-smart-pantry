"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import {
  acceptInviteAndCreateAccount,
  clearInviteFromUrl,
  getInviteContext,
  readInviteCodeFromLocation,
  signInWithAccount,
  type PendingInviteContext,
} from "@/lib/family";

interface LoginScreenProps {
  onLogin: () => void;
  /** Force invite mode (e.g. simulate accept from Manage Family) */
  forcedInviteCode?: string | null;
  onClearForcedInvite?: () => void;
}

type OnboardStep = "welcome" | "household" | "profile";

export function LoginScreen({ onLogin, forcedInviteCode, onClearForcedInvite }: LoginScreenProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [householdName, setHouseholdName] = useState("The Borg Family");
  const [profileEmoji, setProfileEmoji] = useState("👩‍🍳");
  const [onboardStep, setOnboardStep] = useState<OnboardStep | null>(null);
  const [invite, setInvite] = useState<PendingInviteContext | null>(null);
  const [inviteChecked, setInviteChecked] = useState(false);

  const emojiOptions = ["👩‍🍳", "👤", "🧑‍🌾", "👨‍🍳", "🌿", "🧒", "👨", "👩"];

  // Resolve invite from URL or forced simulation
  useEffect(() => {
    const code = forcedInviteCode || readInviteCodeFromLocation();
    if (code) {
      const ctx = getInviteContext(code);
      if (ctx) {
        setInvite(ctx);
        setMode("signup");
        setName(ctx.memberName);
        setProfileEmoji(ctx.memberEmoji || "👤");
        try {
          localStorage.setItem(STORAGE_KEYS.PENDING_INVITE, code);
        } catch {}
      } else if (forcedInviteCode) {
        toast.error("Invite not found", { description: "This member invite is no longer valid." });
        onClearForcedInvite?.();
      }
    } else {
      try {
        const pending = localStorage.getItem(STORAGE_KEYS.PENDING_INVITE);
        if (pending) {
          const ctx = getInviteContext(pending);
          if (ctx) {
            setInvite(ctx);
            setMode("signup");
            setName(ctx.memberName);
            setProfileEmoji(ctx.memberEmoji || "👤");
          }
        }
      } catch {}
    }
    setInviteChecked(true);
  }, [forcedInviteCode, onClearForcedInvite]);

  const resetAuthForm = () => {
    setName("");
    setEmail("");
    setPassword("");
  };

  const dismissInvite = () => {
    setInvite(null);
    clearInviteFromUrl();
    onClearForcedInvite?.();
    try {
      localStorage.removeItem(STORAGE_KEYS.PENDING_INVITE);
    } catch {}
  };

  const handleInviteSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite) return;
    if (!email || !password) {
      toast.error("Please fill out all fields");
      return;
    }

    const result = acceptInviteAndCreateAccount({
      inviteCode: invite.code,
      email,
      password,
      name: name.trim() || invite.memberName,
      emoji: profileEmoji || invite.memberEmoji,
    });

    if (!result.ok) {
      toast.error("Couldn't join", { description: result.error });
      return;
    }

    toast.success("Welcome to the household", {
      description: `You're in ${invite.householdName}. The shared pantry is ready.`,
    });
    onClearForcedInvite?.();
    onLogin();
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Invite path takes priority when active
    if (invite && mode === "signup") {
      handleInviteSignup(e);
      return;
    }

    if (!email || !password || (mode === "signup" && !name)) {
      toast.error("Please fill out all fields");
      return;
    }

    if (mode === "signin") {
      const result = signInWithAccount(email, password);
      if (!result.ok) {
        toast.error("Sign in failed", { description: result.error });
        return;
      }
      toast.success("Welcome back", { description: result.account.name });
      onLogin();
    } else {
      // Owner signup → beautiful onboarding
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
    try {
      localStorage.setItem(STORAGE_KEYS.LOGGED_IN, "true");
    } catch {}
    registerOwnerAccount(displayName, email, password, profileEmoji, householdName);
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
                A calm space to know what&apos;s in your kitchen — no stress, just clarity.
              </p>
              <button
                onClick={() => setOnboardStep("household")}
                className="mt-10 w-full rounded-3xl bg-brand py-3.5 text-sm font-semibold text-brand-foreground active:scale-[0.985] transition"
              >
                Get started
              </button>
              <button
                onClick={() => {
                  setOnboardStep(null);
                  resetAuthForm();
                }}
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
                <button
                  onClick={() => setOnboardStep("welcome")}
                  className="flex-1 rounded-3xl border py-3 text-sm font-semibold active:bg-secondary/70"
                >
                  Back
                </button>
                <button
                  onClick={() => setOnboardStep("profile")}
                  className="flex-1 rounded-3xl bg-brand py-3 text-sm font-semibold text-brand-foreground active:scale-[0.985]"
                >
                  Continue
                </button>
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
                <div className="flex justify-center gap-3 flex-wrap">
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
                <button
                  onClick={() => setOnboardStep("household")}
                  className="flex-1 rounded-3xl border py-3 text-sm font-semibold active:bg-secondary/70"
                >
                  Back
                </button>
                <button
                  onClick={completeOnboarding}
                  className="flex-1 rounded-3xl bg-brand py-3 text-sm font-semibold text-brand-foreground active:scale-[0.985]"
                >
                  Finish setup
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="text-center text-[10px] text-muted-foreground pb-8">
          All data stays on your device in this demo
        </div>
      </div>
    );
  }

  if (!inviteChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-4xl animate-pulse">🥛</div>
      </div>
    );
  }

  // Main calm auth screen
  return (
    <div className="min-h-screen flex flex-col bg-background px-5 pt-[max(3rem,env(safe-area-inset-top))]">
      <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
        <div className="text-center mb-7">
          <div className="mx-auto mb-4 text-6xl">🥛</div>
          <h1 className="font-display text-[38px] tracking-[-0.025em] font-medium">Friġġ</h1>
          <p className="text-muted-foreground mt-1.5 text-[15px]">Your calm family pantry</p>
        </div>

        {/* Invite banner */}
        {invite && (
          <div className="elevated-card mb-5 w-full rounded-[1.65rem] p-4 text-left">
            <div className="flex items-start gap-3">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary text-2xl ring-1 ring-border/30">
                {invite.memberEmoji}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--color-fresh)]">
                  Household invite
                </p>
                <p className="mt-0.5 text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                  Join {invite.householdName}
                </p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Create an account as <span className="font-medium text-foreground/80">{invite.memberName}</span> to
                  see the shared pantry.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissInvite}
              className="mt-3 text-[11px] font-semibold text-muted-foreground underline underline-offset-2"
            >
              Not for me — dismiss invite
            </button>
          </div>
        )}

        <div className="w-full">
          {!invite && (
            <div className="flex gap-1 mb-7 rounded-3xl bg-secondary/60 p-1">
              <button
                onClick={() => {
                  setMode("signin");
                  setOnboardStep(null);
                }}
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
          )}

          {invite && (
            <p className="mb-4 text-center text-[13px] font-semibold text-foreground/80">
              Create your Friġġ account
            </p>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {(mode === "signup" || invite) && (
              <div>
                <label className="text-xs uppercase tracking-[1px] text-muted-foreground block mb-1.5 pl-0.5">
                  Your name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Elena Borg"
                  className="w-full rounded-3xl bg-card border border-border/50 px-5 py-3.5 text-[15px] focus:outline-none focus:border-border/80"
                />
              </div>
            )}

            {invite && (
              <div>
                <label className="text-xs uppercase tracking-[1px] text-muted-foreground block mb-2 pl-0.5">
                  Avatar
                </label>
                <div className="flex flex-wrap gap-2">
                  {emojiOptions.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setProfileEmoji(em)}
                      className={`text-2xl p-2.5 rounded-2xl transition active:scale-95 ${profileEmoji === em ? "bg-secondary ring-1 ring-border" : "opacity-70"}`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs uppercase tracking-[1px] text-muted-foreground block mb-1.5 pl-0.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@family.com"
                className="w-full rounded-3xl bg-card border border-border/50 px-5 py-3.5 text-[15px] focus:outline-none focus:border-border/80"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[1px] text-muted-foreground block mb-1.5 pl-0.5">
                Password
              </label>
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
              {invite
                ? "Join household & continue"
                : mode === "signin"
                  ? "Sign in"
                  : "Create account & continue"}
            </button>
          </form>

          {!invite && (
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
          )}

          {invite && (
            <p className="text-center text-[11px] text-muted-foreground mt-6">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="text-foreground underline underline-offset-2"
              >
                Sign in instead
              </button>
            </p>
          )}
        </div>
      </div>

      <div className="text-center text-[10px] text-muted-foreground pb-8">
        Demo • Everything stays private on your device
      </div>
    </div>
  );
}

function registerOwnerAccount(
  displayName: string,
  email: string,
  password: string,
  emoji: string,
  householdName: string
) {
  try {
    const accountsRaw = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    const accounts = accountsRaw ? JSON.parse(accountsRaw) : [];
    const accountId = `acct-${Date.now()}`;
    const memberId = "you";
    const account = {
      id: accountId,
      memberId,
      email: email.trim().toLowerCase(),
      password,
      name: displayName,
      emoji,
    };
    const next = Array.isArray(accounts)
      ? [...accounts.filter((a: { email?: string }) => a.email !== account.email), account]
      : [account];
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(next));
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, accountId);
    localStorage.setItem(STORAGE_KEYS.HOUSEHOLD, householdName);
    localStorage.setItem(
      STORAGE_KEYS.PROFILE,
      JSON.stringify({ name: displayName, emoji, email: account.email, memberId, accountId })
    );

    const membersRaw = localStorage.getItem(STORAGE_KEYS.FAMILY_MEMBERS);
    let members = membersRaw ? JSON.parse(membersRaw) : null;
    if (!Array.isArray(members) || members.length === 0) {
      members = [
        {
          id: "you",
          name: displayName.split(" ")[0] || "You",
          emoji,
          phone: "",
          inviteCode: Math.random().toString(36).slice(2, 12),
          status: "owner",
          isYou: true,
          email: account.email,
        },
      ];
    } else {
      members = members.map((m: { id: string; status?: string }) => ({
        ...m,
        isYou: m.id === "you" || m.status === "owner",
        ...(m.id === "you"
          ? { name: displayName.split(" ")[0] || m.id, emoji, email: account.email, status: "owner" }
          : { isYou: false }),
      }));
    }
    localStorage.setItem(STORAGE_KEYS.FAMILY_MEMBERS, JSON.stringify(members));
  } catch {}
}
