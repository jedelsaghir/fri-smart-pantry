// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // Explicitly disable Lovable HMR gate for local development to use Vite's native
  // granular Hot Module Replacement + React Fast Refresh (no forced full reloads).
  hmrGate: false,

  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },

  // Pass Vite options to encourage fast default HMR behavior.
  vite: {
    server: {
      // Ensure HMR is enabled (Vite default, but explicit for clarity).
      hmr: true,
      // Use minimal/no debounce on file changes for snappy updates.
      // Note: the Lovable wrapper applies some watch defaults locally;
      // these help get closer to instant Vite fast refresh.
      watch: {
        awaitWriteFinish: {
          stabilityThreshold: 50,
          pollInterval: 10,
        },
      },
    },
    // React Fast Refresh is provided by the wrapper's @vitejs/plugin-react.
    // No need to add it here (would cause duplicates).
  },

  // Forward options directly to the included @vitejs/plugin-react
  // to ensure Vite's default fast refresh (React Fast Refresh) is active.
  react: {
    fastRefresh: true,
    // Use automatic JSX runtime (default and recommended for React 19 + Vite).
    jsxRuntime: "automatic",
  },
});
