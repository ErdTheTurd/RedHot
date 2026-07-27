/** Keyboard / mouse + invisible slash-command capture */

export function createInput() {
  const keys = Object.create(null);
  const mouse = { x: 0, y: 0, dx: 0, dy: 0, down: false, right: false };
  let pointerLocked = false;
  let cmdMode = false;
  let cmdBuffer = '';
  const cmdListeners = [];

  /** Normalize browser key events → consistent codes (WASD + arrows). */
  function codeFromEvent(e) {
    if (e.code && e.code !== 'Unidentified') return e.code;
    const k = e.key;
    if (k === 'ArrowUp' || k === 'Up') return 'ArrowUp';
    if (k === 'ArrowDown' || k === 'Down') return 'ArrowDown';
    if (k === 'ArrowLeft' || k === 'Left') return 'ArrowLeft';
    if (k === 'ArrowRight' || k === 'Right') return 'ArrowRight';
    if (k && k.length === 1) {
      const ch = k.toLowerCase();
      if (ch >= 'a' && ch <= 'z') return `Key${ch.toUpperCase()}`;
    }
    return e.code || '';
  }

  const MOVE_KEYS = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Space', 'Tab',
  ]);

  const onKey = (e, down) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    // Slash commands — invisible console (no textbox)
    if (down && !cmdMode && e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      cmdMode = true;
      cmdBuffer = '/';
      for (const k of Object.keys(keys)) keys[k] = false;
      e.preventDefault();
      return;
    }

    if (cmdMode) {
      if (down) {
        if (e.code === 'Enter' || e.key === 'Enter') {
          const line = cmdBuffer.trim();
          cmdMode = false;
          cmdBuffer = '';
          for (const fn of cmdListeners) fn(line);
          e.preventDefault();
          return;
        }
        if (e.code === 'Escape' || e.key === 'Escape') {
          cmdMode = false;
          cmdBuffer = '';
          e.preventDefault();
          return;
        }
        if (e.code === 'Backspace' || e.key === 'Backspace') {
          cmdBuffer = cmdBuffer.slice(0, -1);
          if (!cmdBuffer) cmdMode = false;
          e.preventDefault();
          return;
        }
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          cmdBuffer += e.key;
          e.preventDefault();
          return;
        }
      }
      e.preventDefault();
      return;
    }

    const code = codeFromEvent(e);
    if (code) keys[code] = down;

    // Also mirror letter keys from e.key so layout quirks still move
    if (e.key && e.key.length === 1) {
      const ch = e.key.toLowerCase();
      if (ch >= 'a' && ch <= 'z') keys[`Key${ch.toUpperCase()}`] = down;
    }
    if (e.key === 'ArrowUp' || e.key === 'Up') keys.ArrowUp = down;
    if (e.key === 'ArrowDown' || e.key === 'Down') keys.ArrowDown = down;
    if (e.key === 'ArrowLeft' || e.key === 'Left') keys.ArrowLeft = down;
    if (e.key === 'ArrowRight' || e.key === 'Right') keys.ArrowRight = down;

    if (MOVE_KEYS.has(code) || MOVE_KEYS.has(e.code)) e.preventDefault();
  };

  window.addEventListener('keydown', (e) => onKey(e, true), { passive: false });
  window.addEventListener('keyup', (e) => {
    if (cmdMode) {
      e.preventDefault();
      return;
    }
    onKey(e, false);
  }, { passive: false });
  window.addEventListener('mousedown', (e) => {
    if (e.button === 0) mouse.down = true;
    if (e.button === 2) mouse.right = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
    if (e.button === 2) mouse.right = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!pointerLocked || cmdMode) return;
    mouse.dx += e.movementX;
    mouse.dy += e.movementY;
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());

  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === document.getElementById('game-canvas');
  });

  return {
    keys,
    mouse,
    get pointerLocked() { return pointerLocked; },
    get cmdMode() { return cmdMode; },
    get cmdBuffer() { return cmdBuffer; },
    onCommand(fn) { cmdListeners.push(fn); },
    requestLock() {
      if (cmdMode) return;
      const c = document.getElementById('game-canvas');
      if (c && !pointerLocked) c.requestPointerLock?.();
    },
    exitLock() {
      if (document.pointerLockElement) document.exitPointerLock?.();
    },
    consumeMouseDelta() {
      const dx = mouse.dx;
      const dy = mouse.dy;
      mouse.dx = 0;
      mouse.dy = 0;
      return { dx, dy };
    },
    pressed(code) {
      if (cmdMode) return false;
      return !!keys[code];
    },
    /** True if any of the codes are down */
    pressedAny(...codes) {
      if (cmdMode) return false;
      return codes.some((c) => !!keys[c]);
    },
    /** Movement helper: WASD or arrow keys */
    moveAxis() {
      if (cmdMode) return { x: 0, z: 0 };
      let x = 0;
      let z = 0;
      if (keys.KeyW || keys.ArrowUp) z += 1;
      if (keys.KeyS || keys.ArrowDown) z -= 1;
      if (keys.KeyA || keys.ArrowLeft) x -= 1;
      if (keys.KeyD || keys.ArrowRight) x += 1;
      return { x, z };
    },
    consumePress(code) {
      if (!keys[code]) return false;
      keys[code] = false;
      return true;
    },
  };
}
