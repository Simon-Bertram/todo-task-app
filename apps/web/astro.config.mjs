// @ts-check
import preact from "@astrojs/preact";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  integrations: [preact()],
  output: "server",
  server: {
    host: "127.0.0.1",
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
