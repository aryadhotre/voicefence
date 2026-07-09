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
        // Lets Android's share sheet (e.g. sharing a WhatsApp voice note)
        // list Voicefence as a target. Received by the fetch handler in
        // public/sw-share-target.js, which stashes the file and redirects
        // to /analyze — see src/pages/Analyze.tsx's pickup effect.
        share_target: {
          action: "/share-target",
          method: "POST",
          enctype: "multipart/form-data",
          params: {
            files: [{ name: "audio", accept: ["audio/*"] }],
          },
        },
      },
      workbox: {
        // Workbox's own fetch listener (installed by the generated SW)
        // only ever calls respondWith() for precached GET requests, so this
        // additional listener — registered via importScripts, per
        // https://developer.chrome.com/docs/workbox/modules/workbox-build/#generateswoptions
        // — can safely own the POST /share-target route alongside it.
        importScripts: ["sw-share-target.js"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
