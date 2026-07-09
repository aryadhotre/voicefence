import { defineConfig } from "@vite-pwa/assets-generator/config"

// The source SVG is already a full-bleed 512x512 square with its own
// #08060d background and safe-zone-compliant glyph — override the
// generator's defaults (30% padding, white fill for maskable/apple) so it
// doesn't add its own letterboxing on top of that.
const resizeOptions = { background: "#08060d" }

export default defineConfig({
  preset: {
    transparent: {
      sizes: [64, 192, 512],
      favicons: [[48, "favicon.ico"]],
      padding: 0,
      resizeOptions,
    },
    maskable: {
      sizes: [512],
      padding: 0,
      resizeOptions,
    },
    apple: {
      sizes: [180],
      padding: 0,
      resizeOptions,
    },
  },
  images: ["public/pwa-icon-source.svg"],
})
