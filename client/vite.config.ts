import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";vvvvvvvv
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

export default defineConfig({
  plugins: [
    tanstackStart({
      server: {
        entry: "server",
      },
    }),
    nitro({
      preset: "vercel",
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  optimizeDeps: {
    include: [
      "@supabase/supabase-js", "zod", "sonner", "lucide-react", "clsx", "tailwind-merge", "class-variance-authority",
      "@radix-ui/react-avatar", "@radix-ui/react-dialog", "@radix-ui/react-alert-dialog", "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label", "@radix-ui/react-slot", "@radix-ui/react-tabs", "@radix-ui/react-select", "@radix-ui/react-radio-group",
    ],
  },
});
