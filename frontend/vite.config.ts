import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Set base to your GitHub repo name for GitHub Pages
  // e.g. if repo is github.com/username/telecom-sales → base: "/telecom-sales/"
  base: process.env.VITE_BASE_URL || "/",
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
