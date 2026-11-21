/** Graphics quality presets — Ultra by default; Low Poly only when the user opts in. */

const STORAGE_KEY = 'vehicle_strike_gfx';

/**
 * Soft hardware hint for UI copy only — never forces Low Poly.
 * Ultra is always the default unless the player checks the box.
 */
export function detectHardwareQuality() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && window.innerWidth < 1100);
  const mem = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 4;
  const constrained = isMobile || mem <= 4 || cores <= 2 || !gl;
  return { isMobile, low: constrained, constrained };
}

/**
 * Only an explicit saved "low" opts into Low Poly.
 * Missing / unknown / auto values always resolve to Ultra (high).
 * @returns {'high'|'low'}
 */
export function getGraphicsPreset() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'low') return 'low';
    if (v === 'high') return 'high';
  } catch {
    /* ignore */
  }
  return 'high';
}

/** @param {'high'|'low'} preset */
export function setGraphicsPreset(preset) {
  const next = preset === 'low' ? 'low' : 'high';
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  return next;
}

/**
 * Full quality profile used by renderer + map builders.
 * Ultra is tuned for laptops: rich materials/lighting without CPU water morph
 * or extreme terrain density that tanks FPS.
 */
export function resolveQuality(preset = getGraphicsPreset()) {
  const low = preset === 'low';
  return {
    preset: low ? 'low' : 'high',
    low,
    label: low ? 'Low Poly' : 'Ultra',
    pixelRatioCap: low ? 1.15 : 1.75,
    shadows: !low,
    shadowSize: low ? 512 : 1536,
    bloom: !low,
    bloomStrength: low ? 0 : 0.22,
    bloomRadius: low ? 0 : 0.48,
    bloomThreshold: low ? 1 : 0.86,
    antialias: !low,
    // UV-scroll water looks rich; vertex morph was the #1 laptop killer
    waterSeg: low ? 16 : 64,
    landStep: low ? 5 : 2.15,
    propDensity: low ? 0.35 : 1.0,
    flatLand: low,
    animateWater: false,
    detailMeshes: !low,
    fogBoost: low ? 1.2 : 0.95,
    landmarkDetail: !low,
  };
}
