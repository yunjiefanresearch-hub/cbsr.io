/* CBSR — a local, dependency-free particle sculpture. */
(() => {
  'use strict';

  const start = () => {
    const canvas = document.getElementById('cbsr-field');
    if (!canvas || canvas.dataset.fieldReady) return;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;
    canvas.dataset.fieldReady = 'true';

    const host = canvas.parentElement || canvas;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const TAU = Math.PI * 2;
    const palette = [
      '#55575d', '#6c6f77', '#868992', '#9ea2ac',
      '#b9bdc6', '#d8dbe2', '#f2f1f6', '#aaa3bf', '#c5bfd7'
    ];
    let width = 0;
    let height = 0;
    let scale = 1;
    let frame = 0;
    let lastTime = 0;
    let elapsed = 0;
    let inView = true;
    let particles = [];
    let projected = [];
    let resizeFrame = 0;
    let randomState = 20170619;
    const pointer = { x: -1000, y: -1000, active: false };

    const random = () => {
      randomState = (randomState * 1664525 + 1013904223) >>> 0;
      return randomState / 4294967296;
    };
    const signedPower = (value, exponent) => Math.sign(value) * Math.pow(Math.abs(value), exponent);

    const makeParticles = () => {
      randomState = 20170619;
      const compact = width < 540;
      const count = compact ? 1800 : 5400;
      particles = [];
      for (let i = 0; i < count; i += 1) {
        const u = random() * TAU;
        const v = random() * TAU;
        const cu = Math.cos(u);
        const su = Math.sin(u);
        // The flattened left shoulder and broad right arc recall the CBSR mark.
        const centerX = signedPower(cu, 0.79) * (cu < 0 ? 1.04 : 1.13);
        const centerY = signedPower(su, 0.84) * 1.02;
        const tube = 0.34 + 0.055 * Math.sin(u - 0.6) + 0.025 * Math.cos(3 * u);
        const band = (i % 11 === 0 ? 0.84 : 1) + random() * 0.035;
        const radial = Math.cos(v) * tube * band;
        particles.push({
          x: centerX + cu * radial,
          y: centerY + su * radial,
          z: Math.sin(v) * tube * 0.93 + 0.12 * Math.sin(u * 2 - 0.7),
          nx: cu * Math.cos(v),
          ny: su * Math.cos(v),
          nz: Math.sin(v),
          phase: random() * TAU,
          size: 0.45 + random() * 0.55,
          lavender: random() < 0.035,
          grain: random(),
          ox: 0, oy: 0, vx: 0, vy: 0,
          route: false
        });
      }
      // Four sparse lanes travel through the opening, matching the mark's bars.
      const laneCount = compact ? 56 : 140;
      for (let lane = 0; lane < 4; lane += 1) {
        for (let i = 0; i < laneCount; i += 1) {
          particles.push({
            lane,
            progress: random(),
            grain: random(),
            phase: random() * TAU,
            size: 0.35 + random() * 0.5,
            lavender: lane === 1 && i % 4 === 0,
            ox: 0, oy: 0, vx: 0, vy: 0,
            route: true
          });
        }
      }
      projected = particles.map((particle) => ({ particle, x: 0, y: 0, z: 0, light: 0, radius: 0 }));
    };

    const rotate = (x, y, z, cx, sx, cy, sy, cz, sz) => {
      const ry = y * cx - z * sx;
      const rz = y * sx + z * cx;
      const rx = x * cy + rz * sy;
      const depth = -x * sy + rz * cy;
      return [rx * cz - ry * sz, rx * sz + ry * cz, depth];
    };

    const draw = (time, delta) => {
      context.clearRect(0, 0, width, height);
      const still = motion.matches;
      const slow = still ? 0 : time;
      const ax = -0.39 + Math.sin(slow * 0.11) * 0.025;
      const ay = -0.44 + Math.sin(slow * 0.085) * 0.055;
      const az = -0.28 + Math.sin(slow * 0.07) * 0.025;
      const cx = Math.cos(ax), sx = Math.sin(ax);
      const cy = Math.cos(ay), sy = Math.sin(ay);
      const cz = Math.cos(az), sz = Math.sin(az);
      const centerX = width * 0.515;
      const centerY = height * 0.49;
      const step = Math.min(delta * 60, 1.8);
      const reach = Math.min(110, width * 0.18);

      for (let i = 0; i < projected.length; i += 1) {
        const point = projected[i];
        const particle = point.particle;
        let x = particle.x, y = particle.y, z = particle.z;
        let normal;
        if (particle.route) {
          const progress = (particle.progress + slow * 0.018) % 1;
          x = -2.5 + progress * 5.1;
          y = (particle.lane - 1.5) * 0.16 + Math.sin(progress * Math.PI) * 0.08;
          z = Math.sin(progress * TAU + particle.lane * 0.22) * 0.15;
          y += (particle.grain - 0.5) * 0.027;
          normal = [0, 0, 0.3];
        } else {
          const drift = Math.sin(slow * 0.26 + particle.phase) * 0.008;
          x += particle.nx * drift;
          y += particle.ny * drift;
          z += particle.nz * drift;
          normal = rotate(particle.nx, particle.ny, particle.nz, cx, sx, cy, sy, cz, sz);
        }
        const position = rotate(x, y, z, cx, sx, cy, sy, cz, sz);
        const perspective = 5.8 / (5.8 - position[2]);
        const px = centerX + position[0] * scale * perspective;
        const py = centerY + position[1] * scale * perspective;

        if (!still) {
          if (pointer.active) {
            const dx = px + particle.ox - pointer.x;
            const dy = py + particle.oy - pointer.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < reach && distance > 0.1) {
              const force = Math.pow(1 - distance / reach, 2) * 1.65 * step;
              particle.vx += dx / distance * force;
              particle.vy += dy / distance * force;
            }
          }
          particle.vx += -particle.ox * 0.021 * step;
          particle.vy += -particle.oy * 0.021 * step;
          particle.vx *= Math.pow(0.88, step);
          particle.vy *= Math.pow(0.88, step);
          particle.ox += particle.vx * step;
          particle.oy += particle.vy * step;
        }

        point.x = px + (still ? 0 : particle.ox);
        point.y = py + (still ? 0 : particle.oy);
        point.z = position[2];
        const illumination = Math.max(0, normal[0] * -0.25 + normal[1] * -0.42 + normal[2] * 0.82);
        point.light = particle.route ? 0.32 + particle.grain * 0.24 : 0.18 + illumination * 0.72 + particle.grain * 0.16;
        point.radius = particle.size * perspective * (width < 540 ? 0.86 : 1.02);
      }
      projected.sort((a, b) => a.z - b.z);

      for (let i = 0; i < projected.length; i += 1) {
        const point = projected[i];
        const particle = point.particle;
        const brightness = Math.min(6, Math.floor(point.light * 6.5));
        context.fillStyle = palette[particle.lavender ? (brightness > 3 ? 8 : 7) : brightness];
        context.globalAlpha = particle.route ? 0.3 + particle.grain * 0.38 : 0.46 + point.light * 0.5;
        context.beginPath();
        context.arc(point.x, point.y, point.radius, 0, TAU);
        context.fill();
      }
      context.globalAlpha = 1;
    };

    const canAnimate = () => !motion.matches && inView && !document.hidden && width > 0 && height > 0;
    const tick = (now) => {
      frame = 0;
      if (!canAnimate()) return;
      const delta = lastTime ? Math.min((now - lastTime) / 1000, 0.035) : 1 / 60;
      lastTime = now;
      elapsed += delta;
      draw(elapsed, delta);
      frame = window.requestAnimationFrame(tick);
    };
    const syncAnimation = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      if (canAnimate()) frame = window.requestAnimationFrame(tick);
      else if (motion.matches && width > 0) draw(0, 0);
    };
    const resize = () => {
      resizeFrame = 0;
      const bounds = canvas.getBoundingClientRect();
      const nextWidth = Math.round(bounds.width);
      const nextHeight = Math.round(bounds.height);
      if (!nextWidth || !nextHeight) return;
      const rebuild = (width < 540) !== (nextWidth < 540) || !particles.length;
      width = nextWidth;
      height = nextHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      scale = Math.min(width * 0.295, height * 0.29);
      if (rebuild) makeParticles();
      draw(motion.matches ? 0 : elapsed, 0);
      syncAnimation();
    };
    const queueResize = () => {
      if (!resizeFrame) resizeFrame = window.requestAnimationFrame(resize);
    };

    host.addEventListener('pointermove', (event) => {
      if (motion.matches || event.pointerType === 'touch') return;
      const bounds = canvas.getBoundingClientRect();
      pointer.x = event.clientX - bounds.left;
      pointer.y = event.clientY - bounds.top;
      pointer.active = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= width && pointer.y <= height;
    }, { passive: true });
    host.addEventListener('pointerleave', () => { pointer.active = false; }, { passive: true });
    document.addEventListener('visibilitychange', syncAnimation);
    window.addEventListener('resize', queueResize, { passive: true });
    if (motion.addEventListener) motion.addEventListener('change', syncAnimation);
    else if (motion.addListener) motion.addListener(syncAnimation);
    if ('ResizeObserver' in window) new ResizeObserver(queueResize).observe(host);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        inView = entries[0].isIntersecting;
        syncAnimation();
      }, { threshold: 0 }).observe(canvas);
    }
    resize();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
