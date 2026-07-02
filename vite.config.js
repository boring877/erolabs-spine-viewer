import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server on 5176 (the extractor uses 5175).
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5176,
    strictPort: true,
  },
});
