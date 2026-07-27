/**
 * Rewarded ads adapter — max 5 watches per calendar day.
 *
 * TO GO LIVE (what you must do — I cannot create accounts for you):
 * 1. Pick a rewarded-ad network that works on web GitHub Pages, e.g.:
 *    - Google AdSense / Ad Manager (rewarded ads) — needs a Google AdSense account + site approval
 *    - Or wrap the game in Capacitor/Cordova and use AdMob rewarded ads
 * 2. Create a Rewarded Ad unit and copy the publisher / ad-unit IDs
 * 3. In index.html (before main.js), set:
 *
 *    <script>
 *      window.VehicleStrikeAds = {
 *        // return a Promise that resolves { ok: true } after a completed rewarded view
 *        // or { ok: false, reason: '...' } if skipped/failed
 *        showRewarded: async () => {
 *          // Call your SDK here (AdSense rewarded / AdMob / etc.)
 *          // Resolve only when the user earned the reward callback
 *          return { ok: true };
 *        }
 *      };
 *    </script>
 *
 * Until that hook exists, the game uses a short DEMO ad so you can test the UX.
 */

export const MAX_ADS_PER_DAY = 5;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeAdsState(ads = {}) {
  const day = todayKey();
  if (ads.date !== day) return { date: day, count: 0 };
  return { date: day, count: Math.max(0, ads.count | 0) };
}

export function adsRemaining(ads) {
  const s = normalizeAdsState(ads);
  return Math.max(0, MAX_ADS_PER_DAY - s.count);
}

export function canWatchAd(ads) {
  return adsRemaining(ads) > 0;
}

/** Demo placeholder — replaced when window.VehicleStrikeAds.showRewarded is set */
function demoRewardedAd() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'ad-demo-overlay';
    overlay.innerHTML = `
      <div class="ad-demo-card">
        <p class="ad-demo-kicker">DEMO REWARDED AD</p>
        <h3>Sponsored break</h3>
        <p>Connect a real ad network in <code>window.VehicleStrikeAds</code> to monetize. This preview completes in a few seconds.</p>
        <div class="ad-demo-bar"><i id="ad-demo-fill"></i></div>
        <button class="btn btn-ghost" id="ad-demo-skip">SKIP (no reward)</button>
      </div>
    `;
    document.body.appendChild(overlay);
    const fill = overlay.querySelector('#ad-demo-fill');
    let t = 0;
    const dur = 3.2;
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      clearInterval(iv);
      overlay.remove();
      resolve(ok ? { ok: true } : { ok: false, reason: 'Ad skipped' });
    };
    const iv = setInterval(() => {
      t += 0.05;
      fill.style.width = `${Math.min(100, (t / dur) * 100)}%`;
      if (t >= dur) finish(true);
    }, 50);
    overlay.querySelector('#ad-demo-skip').onclick = () => finish(false);
  });
}

export async function showRewardedAd() {
  const hook = window.VehicleStrikeAds?.showRewarded;
  if (typeof hook === 'function') {
    try {
      const res = await hook();
      if (res && res.ok) return { ok: true };
      return { ok: false, reason: res?.reason || 'Ad not completed' };
    } catch (err) {
      return { ok: false, reason: err?.message || 'Ad failed' };
    }
  }
  return demoRewardedAd();
}
