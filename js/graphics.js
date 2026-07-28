/** Graphics quality presets — high spectacle vs low-poly / GPU-saver */

const STORAGE_KEY = 'vehicle_strike_gfx';

export function detectHardwareQuality() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && window.innerWidth < 1100);
  const mem = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 4;
  const low = isMobile || mem <= 4 || cores <= 2 || !gl;
  return { isMobile, low };
}

/** @returns {'high'|'low'} */
export function getGraphicsPreset() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'low' || v === 'high') return v;
  } catch {
    /* ignore */
  }
  return detectHardwareQuality().low ? 'low' : 'high';
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

/** Full quality profile used by renderer + map builders. */
export function resolveQuality(preset = getGraphicsPreset()) {
  const low = preset === 'low';
  return {
    preset,
    low,
    label: low ? 'Low Poly' : 'Ultra',
    pixelRatioCap: low ? 1.15 : 2,
    shadows: !low,
    shadowSize: low ? 512 : 2048,
    bloom: !low,
    antialias: !low,
    waterSeg: low ? 20 : 96,
    landStep: low ? 5 : 2.2,
    propDensity: low ? 0.35 : 1,
    flatLand: low,
    animateWater: !low,
    detailMeshes: !low,
    fogBoost: low ? 1.15 : 1,
  };
}
