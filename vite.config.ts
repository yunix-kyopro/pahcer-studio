import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import * as path from "path";

export default defineConfig({
  plugins: [react()],
  root: "src/renderer",
  publicDir: path.resolve(__dirname, "public"),
  build: {
    outDir: "../../dist/renderer",
    emptyOutDir: true,
  },
  base: "./",
});
