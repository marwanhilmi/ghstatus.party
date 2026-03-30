// Augment the auto-generated Env with secrets and type fixes
// that `wrangler types` cannot derive automatically.

declare namespace Cloudflare {
  interface Env {
    ADMIN_SECRET?: string
  }
}
