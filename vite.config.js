import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS === "true" ? "/Reisirisk/" : "/",
  server: {
    port: 5173,
    strictPort: false,
  },
});
