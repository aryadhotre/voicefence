// Client side of the Web Share Target flow — see public/sw-share-target.js
// for the service worker side that populates this cache entry, and
// vite.config.ts's manifest.share_target for the registration.

const SHARE_CACHE = "voicefence-share-target-v1"
const SHARE_KEY = "/__shared-audio"

// Matches the backend's MAX_UPLOAD_MB default (see backend/.env.example
// and backend/app/config.py) — also the figure already shown in the
// Analyze dropzone's "Max 25MB by default" copy.
export const MAX_SHARE_UPLOAD_MB = 25

export interface SharedAudioResult {
  file: File
}

export type SharedAudioError = "invalid-type" | "too-large"

/**
 * Looks for a file the service worker stashed after intercepting a Web
 * Share Target POST, validates it, and removes it from the cache either
 * way (single-use — a page refresh shouldn't re-trigger analysis).
 * Returns null if there's nothing pending (the normal case for a direct
 * visit to /analyze).
 */
export async function consumePendingSharedAudio(): Promise<
  { ok: true; file: File } | { ok: false; error: SharedAudioError } | null
> {
  if (!("caches" in window)) return null

  const cache = await caches.open(SHARE_CACHE)
  const response = await cache.match(SHARE_KEY)
  if (!response) return null

  await cache.delete(SHARE_KEY)

  const type = response.headers.get("Content-Type") || "application/octet-stream"
  const encodedName = response.headers.get("X-Shared-Filename")
  const filename = encodedName ? decodeURIComponent(encodedName) : "shared-audio"

  if (!type.startsWith("audio/")) {
    return { ok: false, error: "invalid-type" }
  }

  const blob = await response.blob()
  if (blob.size > MAX_SHARE_UPLOAD_MB * 1024 * 1024) {
    return { ok: false, error: "too-large" }
  }

  return { ok: true, file: new File([blob], filename, { type }) }
}
