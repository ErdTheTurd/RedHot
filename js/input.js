/** Keyboard / mouse + invisible slash-command capture */

export function createInput() {
  const keys = Object.create(null);
  const mouse = { x: 0, y: 0, dx: 0, dy: 0, down: false, right: false };
  let pointerLocked = false;
  let cmdMode = false;
  let cmdBuffer = '';
  const cmdListeners = [];

  const onKey = (e, down) => {
    // Slash commands — invisible console (no textbox)
    if (down && !cmdMode && e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      cmdMode = true;
      cmdBuffer = '/';
      // clear movement keys so you don't keep strafing while typing
      for (const k of Object.keys(keys)) keys[k] = false;
      e.preventDefault();
      return;
    }

    if (cmdMode) {
      if (down) {
        if (e.code === 'Enter') {
          const line = cmdBuffer.trim();
          cmdMode = false;
          cmdBuffer = '';
          for (const fn of cmdListeners) fn(line);
          e.preventDefault();
          return;
        }
        if (e.code === 'Escape') {
          cmdMode = false;
          cmdBuffer = '';
          e.preventDefault();
          return;
        }
        if (e.code === 'Backspace') {
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
      // swallow all keys while typing a command
      e.preventDefault();
      return;
    }

    keys[e.code] = down;
    if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
  };

  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => {
    if (cmdMode) {
      e.preventDefault();
      return;
    }
    onKey(e, false);
  });
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
    consumePress(code) {
      if (!keys[code]) return false;
      keys[code] = false;
      return true;
    },
  };
}
