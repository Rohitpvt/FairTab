/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
  },
  base: process.env.VITE_APP_BASE_PATH || "/FairTab/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "prompt",
      injectRegister: "auto",
      manifest: {
        name: "FairTab",
        short_name: "FairTab",
        description: "Every expense, fairly shared.",
        theme_color: "#0b0f19",
        background_color: "#060810",
        display: "standalone",
        start_url: "/FairTab/",
        scope: "/FairTab/",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable"
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: "module"
      }
    })
  ],
  resolve: {
    alias: {
      "@/app": path.resolve(__dirname, "./src/app"),
      "@/components": path.resolve(__dirname, "./src/components"),
      "@/features": path.resolve(__dirname, "./src/features"),
      "@/domain": path.resolve(__dirname, "./src/domain"),
      "@/infrastructure": path.resolve(__dirname, "./src/infrastructure"),
      "@/services": path.resolve(__dirname, "./src/services"),
      "@/styles": path.resolve(__dirname, "./src/styles"),
      "@/types": path.resolve(__dirname, "./src/types")
    }
  }
});

