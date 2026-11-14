/**
 * Service worker for the installable app (mobile check-in, 2026-11-14).
 * It caches NOTHING on purpose: HR data must always be live, and a stale
 * app shell after a deploy would be worse than no offline mode. Its only job
 * is to make the site installable and take over new versions at once.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
