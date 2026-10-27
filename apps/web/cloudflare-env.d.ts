import type { WebEnv } from "@todo-task-app/infra/alchemy.run";

// Infers cloudflare:workers env from the Alchemy Website.Astro bindings.
// @see https://alchemy.run/cloudflare/frontend/astro

export type CloudflareEnv = WebEnv;

declare global {
  // Astro types App.Locals via a global namespace.
  // biome-ignore lint/style/noNamespace: Astro App.Locals contract
  namespace App {
    interface Locals {
      runtime: {
        env: CloudflareEnv;
      };
    }
  }
}

declare module "cloudflare:workers" {
  // Cloudflare's Env augmentation API requires a namespace.
  // biome-ignore lint/style/noNamespace: Workers ambient module contract
  namespace Cloudflare {
    export interface Env extends CloudflareEnv {}
  }
}
