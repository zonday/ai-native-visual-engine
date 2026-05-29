import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: { port: 5173 },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
