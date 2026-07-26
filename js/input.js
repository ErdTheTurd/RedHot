export function createInput() {
  const keys = Object.create(null);
  const mouse = { x: 0, y: 0, dx: 0, dy: 0, down: false, right: false };
  let pointerLocked = false;

  const onKey = (e, down) => {
    keys[e.code] = down;
    if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
  };

  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  window.addEventListener('mousedown', (e) => {
    if (e.button === 0) mouse.down = true;
    if (e.button === 2) mouse.right = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
    if (e.button === 2) mouse.right = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!pointerLocked) return;
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
    requestLock() {
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
      return !!keys[code];
    },
  };
}
