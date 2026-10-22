export interface Fix {
  lat: number;
  lng: number;
  /** Browser's own error radius in metres (95% confidence). */
  accuracyM: number;
}

/** Stop early once a fix is this good — a phone GPS gets here in a second or two. */
const GOOD_ENOUGH_M = 30;

/**
 * The best location the browser can give within `windowMs`: never a cached
 * fix (`maximumAge: 0`), high accuracy, and the sharpest reading seen while
 * watching. Laptops locate by Wi-Fi / IP and the first fix is often the
 * worst, so watching for a few seconds matters (test-pass fix, 2026-10-22).
 * Denied / unavailable / nothing in time resolves to undefined.
 */
export const bestPosition = (windowMs = 5000): Promise<Fix | undefined> =>
  new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(undefined);
    let best: Fix | undefined;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      resolve(best);
    };
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
        };
        if (!best || fix.accuracyM < best.accuracyM) best = fix;
        if (fix.accuracyM <= GOOD_ENOUGH_M) finish();
      },
      // Denied ends it now; a transient error just waits for the window.
      (err) => {
        if (err.code === err.PERMISSION_DENIED) finish();
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: windowMs },
    );
    const timer = setTimeout(finish, windowMs);
  });
