// Static starter files written into every fresh Full Project sandbox before
// the AI-generated files are layered on top. Kept as plain string constants
// (rather than read from disk at runtime) so the template always ships with
// the serverless bundle, with no filesystem tracing configuration needed.

export const PROJECT_TEMPLATE_FILES: Record<string, string> = {
  "package.json": JSON.stringify(
    {
      name: "sandbox-project",
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: {
        dev: "vite --host --port 5173 --strictPort",
        build: "vite build",
      },
      dependencies: {
        react: "^18.3.1",
        "react-dom": "^18.3.1",
      },
      // NOTE: no "typescript" or "@types/*" packages here on purpose. The dev
      // server never runs a type-check (the "dev"/"build" scripts below only
      // invoke Vite, never `tsc`), and Vite's esbuild transform strips
      // TypeScript syntax from .tsx files without needing the "typescript"
      // package installed at all. Skipping it cuts one of the single
      // heaviest packages out of every fresh WebContainer `npm install`
      // (typescript's unpacked size alone rivals the rest of this list
      // combined) with zero effect on what actually runs in the preview.
      devDependencies: {
        "@tailwindcss/vite": "^4.0.0",
        "@vitejs/plugin-react": "^4.3.1",
        tailwindcss: "^4.0.0",
        vite: "^5.4.8",
      },
    },
    null,
    2
  ),

  "vite.config.ts": `import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// The WebContainer preview is served from a dynamic
// *.webcontainer-api.io hostname, so Vite's dev-server host check must be
// disabled or the preview will be rejected with "Blocked request".
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
})
`,

  "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sandbox Preview</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,

  "tsconfig.json": JSON.stringify(
    {
      compilerOptions: {
        target: "ES2020",
        useDefineForClassFields: true,
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        module: "ESNext",
        skipLibCheck: true,
        moduleResolution: "bundler",
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: "react-jsx",
        strict: true,
      },
      include: ["src"],
    },
    null,
    2
  ),

  "src/main.tsx": `import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
`,

  "src/index.css": `@import "tailwindcss";
`,

  "src/App.tsx": `export default function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-100">
      <p className="text-sm text-neutral-400">Waiting for the first prompt&hellip;</p>
    </main>
  )
}
`,
}
