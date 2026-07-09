// Imported into the Workbox-generated service worker via
// `workbox.importScripts` in vite.config.ts. Handles the Web Share Target
// POST declared in the manifest's `share_target` block — Workbox's own
// fetch listener only ever calls respondWith() for precached GET requests,
// so this second `fetch` listener can safely own the POST /share-target
// route.
//
// Storage key here (SHARE_CACHE / SHARE_KEY) must match the constants of
// the same name read on the client in src/lib/shareTarget.ts.

const SHARE_CACHE = "voicefence-share-target-v1"
const SHARE_KEY = "/__shared-audio"

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)
  if (event.request.method === "POST" && url.pathname === "/share-target") {
    event.respondWith(handleShareTarget(event))
  }
})

async function handleShareTarget(event) {
  try {
    const formData = await event.request.formData()
    const file = formData.get("audio")

    if (file && typeof file === "object" && "size" in file && file.size > 0) {
      const cache = await caches.open(SHARE_CACHE)
      const headers = new Headers()
      headers.set("Content-Type", file.type || "application/octet-stream")
      headers.set("X-Shared-Filename", encodeURIComponent(file.name || "shared-audio"))
      await cache.put(SHARE_KEY, new Response(file, { headers }))
    }
  } catch {
    // No pending file will be found client-side — /analyze falls back to
    // its normal empty state, nothing further to report from in here.
  }

  return Response.redirect("/analyze?shared=1", 303)
}
