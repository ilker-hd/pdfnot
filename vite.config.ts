import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/pdfnot/",
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/apple-touch-icon.png"],
      manifest: {
        name: "Melisa'nın Defteri",
        short_name: "Defterim",
        description: "PDF üzerine not alma ve serbest çizim uygulaması",
        start_url: ".",
        display: "standalone",
        background_color: "#f4f2ee",
        theme_color: "#1f6fe0",
        lang: "tr",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
});
