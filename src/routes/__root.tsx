import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);

  // Render a static fallback on server/ initial to avoid calling router hooks (which use internal context)
  // before providers are ready. This prevents "useContext on null" during SSR/hydration for error cases.
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            This page didn't load
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Something went wrong on our end. You can try refreshing or head back home.
          </p>
        </div>
      </div>
    );
  }

  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" },
      { title: "Friġġ • Smart Pantry" },
      { name: "description", content: "Friġġ is a calm, premium pantry tracker for families — know what's in your fridge, freezer, and pantry at a glance." },
      { name: "author", content: "Friġġ" },
      { name: "theme-color", content: "#f6f4ee" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Friġġ" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "msapplication-TileColor", content: "#f6f4ee" },
      { property: "og:title", content: "Friġġ" },
      { property: "og:description", content: "Friġġ is a calm, premium pantry tracker for families — know what's in your fridge, freezer, and pantry at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Friġġ" },
      { name: "twitter:description", content: "Friġġ is a calm, premium pantry tracker for families — know what's in your fridge, freezer, and pantry at a glance." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fdf9824f-92c7-4004-a29d-e9ae3ee46728/id-preview-0a6701a8--ec87e693-e81a-46f5-90dd-408f1e0cb710.lovable.app-1783840622795.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fdf9824f-92c7-4004-a29d-e9ae3ee46728/id-preview-0a6701a8--ec87e693-e81a-46f5-90dd-408f1e0cb710.lovable.app-1783840622795.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  // Safe access with null check / default (prevents useContext errors if router context not yet provided)
  const routeCtx = Route.useRouteContext() ?? {};
  const queryClient = useMemo(() => {
    const fromCtx = (routeCtx as { queryClient?: QueryClient }).queryClient;
    if (fromCtx) return fromCtx;
    // fallback (shouldn't normally be needed)
    if (typeof window !== 'undefined') {
      (window as any).__qc = (window as any).__qc || new QueryClient();
      return (window as any).__qc;
    }
    return new QueryClient();
  }, [routeCtx]);

  // Apply saved or system theme early on client (useLayoutEffect to reduce flash, avoids SSR issues)
  useLayoutEffect(() => {
    const saved = localStorage.getItem("friggg-theme");
    const prefers = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    if (saved === "dark" || (!saved && prefers)) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  // Register service worker for PWA + basic offline support
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const registerSW = async () => {
        try {
          const reg = await navigator.serviceWorker.register("/sw.js");
          // Optional: listen for updates
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  // New content available; could show a toast in real app
                }
              });
            }
          });
        } catch (err) {
          // SW registration failed (e.g. http in dev sometimes) — safe to ignore for demo
          console.log("SW registration skipped", err);
        }
      };
      // Delay slightly so initial load is fast
      const t = setTimeout(registerSW, 800);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster position="top-center" richColors closeButton />
    </QueryClientProvider>
  );
}
