import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // Serve the manifest + service worker in `npm run dev` too, not just
      // production builds — needed to test installability locally.
      devOptions: {
        enabled: true,
        type: "module",
      },
      manifest: {
        name: "Voicefence",
        short_name: "Voicefence",
        description:
          "Detects AI-cloned voices in WhatsApp voice notes and phone calls — codec-robust, Hindi-English code-switch aware.",
        // Matches the app's actual background (see index.css / Layout.tsx),
        // not a generic default.
        theme_color: "#08060d",
        background_color: "#08060d",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
