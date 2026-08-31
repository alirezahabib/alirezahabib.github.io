(function () {
  "use strict";

  const BRAIN_POINTS = [
    [0.50, 0.92], [0.42, 0.88], [0.34, 0.84], [0.28, 0.77],
    [0.20, 0.72], [0.16, 0.63], [0.11, 0.56], [0.13, 0.46],
    [0.10, 0.38], [0.15, 0.29], [0.22, 0.25], [0.23, 0.17],
    [0.32, 0.11], [0.41, 0.10], [0.50, 0.17], [0.59, 0.10],
    [0.68, 0.11], [0.77, 0.17], [0.78, 0.25], [0.85, 0.29],
    [0.90, 0.38], [0.87, 0.46], [0.89, 0.56], [0.84, 0.63],
    [0.80, 0.72], [0.72, 0.77], [0.66, 0.84], [0.58, 0.88],
    [0.50, 0.92],
    [0.50, 0.17], [0.48, 0.27], [0.52, 0.36], [0.48, 0.45],
    [0.52, 0.54], [0.49, 0.63], [0.51, 0.73], [0.50, 0.82],
    [0.50, 0.92],
    [0.43, 0.22], [0.35, 0.19], [0.29, 0.25], [0.36, 0.31],
    [0.27, 0.35], [0.20, 0.42], [0.28, 0.48], [0.20, 0.55],
    [0.29, 0.60], [0.24, 0.67], [0.33, 0.72], [0.41, 0.69],
    [0.44, 0.79],
    [0.57, 0.22], [0.65, 0.19], [0.71, 0.25], [0.64, 0.31],
    [0.73, 0.35], [0.80, 0.42], [0.72, 0.48], [0.80, 0.55],
    [0.71, 0.60], [0.76, 0.67], [0.67, 0.72], [0.59, 0.69],
    [0.56, 0.79]
  ];

  function arrangeBrainOutline(particles) {
    const frame = document.querySelector(".particles-photo-frame");

    if (!frame) {
      return;
    }

    const minimumParticleCount = BRAIN_POINTS.length + 12;
    const missingCount = Math.max(0, minimumParticleCount - particles.particles.array.length);
    const canvas = particles.canvas.el;

    particles.particles.move.enable = true;
    particles.particles.move.speed = 1.35 * (particles.canvas.pxratio || 1);
    particles.particles.line_linked.opacity = 0.46;
    particles.particles.number.density.enable = false;

    if (missingCount) {
      particles.fn.modes.pushParticles(missingCount);
    }

    function brainGeometry() {
      const canvasRect = particles.canvas.el.getBoundingClientRect();
      const ratioX = particles.canvas.w / canvasRect.width;
      const ratioY = particles.canvas.h / canvasRect.height;
      const brainWidthCss = Math.min(
        1400,
        canvasRect.width * 1.22,
        Math.max(canvasRect.width * 1.18, canvasRect.height * 0.92)
      );
      const brainHeightCss = Math.min(canvasRect.height * 0.86, brainWidthCss * 0.72);

      return {
        width: brainWidthCss * ratioX,
        height: brainHeightCss * ratioY,
        centerX: particles.canvas.w * 0.5,
        centerY: particles.canvas.h * 0.43,
        ratioX: ratioX
      };
    }

    function brainTarget(index, geometry) {
      const point = BRAIN_POINTS[index];
      return {
        x: geometry.centerX + (point[0] - 0.5) * geometry.width,
        y: geometry.centerY + (point[1] - 0.51) * geometry.height
      };
    }

    const initialGeometry = brainGeometry();
    const brainParticles = particles.particles.array.slice(0, BRAIN_POINTS.length);

    brainParticles.forEach(function (particle, index) {
      const target = brainTarget(index, initialGeometry);
      particle.x = target.x;
      particle.y = target.y;
      particle.vx = (Math.random() - 0.5) * 1.2;
      particle.vy = (Math.random() - 0.5) * 1.2;
      particle.vx_i = particle.vx;
      particle.vy_i = particle.vy;
    });

    particles.interactivity.events.onclick.enable = false;
    canvas.addEventListener("click", function (event) {
      const canvasRect = canvas.getBoundingClientRect();
      const ratioX = particles.canvas.w / canvasRect.width;
      const ratioY = particles.canvas.h / canvasRect.height;
      particles.fn.modes.pushParticles(4, {
        pos_x: (event.clientX - canvasRect.left) * ratioX,
        pos_y: (event.clientY - canvasRect.top) * ratioY
      });
    });

    function keepBrainLoose(time) {
      const geometry = brainGeometry();
      const spring = 0.00042;
      const damping = 0.9994;

      particles.particles.line_linked.distance = Math.min(220, Math.max(175, canvas.getBoundingClientRect().width * 0.44))
        * geometry.ratioX;

      brainParticles.forEach(function (particle, index) {
        const target = brainTarget(index, geometry);
        const phase = index * 0.61;
        target.x += Math.sin(time / 1800 + phase) * 7 * geometry.ratioX;
        target.y += Math.cos(time / 2100 + phase) * 5 * geometry.ratioX;
        particle.vx = (particle.vx + (target.x - particle.x) * spring) * damping;
        particle.vy = (particle.vy + (target.y - particle.y) * spring) * damping;
      });

      window.requestAnimationFrame(keepBrainLoose);
    }

    window.requestAnimationFrame(keepBrainLoose);
  }

  function enableAppleEasterEgg() {
    const trigger = document.querySelector(".apple-easter-trigger");

    if (!trigger) {
      return;
    }

    const cursor = document.createElement("span");
    let active = false;
    cursor.className = "classic-mac-pointer";
    cursor.setAttribute("aria-hidden", "true");
    document.body.appendChild(cursor);

    function moveCursor(event) {
      cursor.style.transform = "translate3d(" + (event.clientX - 23) + "px," + (event.clientY - 14) + "px,0)";
    }

    function deactivate() {
      active = false;
      document.documentElement.classList.remove("classic-mac-cursor");
      trigger.classList.remove("is-active");
      trigger.setAttribute("aria-pressed", "false");
      cursor.classList.remove("is-visible");
      window.removeEventListener("pointermove", moveCursor);
    }

    function activate(event) {
      moveCursor(event);

      if (active) {
        deactivate();
        return;
      }

      active = true;
      document.documentElement.classList.add("classic-mac-cursor");
      trigger.classList.add("is-active");
      trigger.setAttribute("aria-pressed", "true");
      cursor.classList.add("is-visible");
      window.addEventListener("pointermove", moveCursor);
    }

    trigger.addEventListener("click", activate);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        deactivate();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    enableAppleEasterEgg();
    particlesJS.load("particles-js", "/assets/json/particles.json", function () {
      const particles = window.pJSDom && window.pJSDom[window.pJSDom.length - 1];

      if (particles && particles.pJS) {
        arrangeBrainOutline(particles.pJS);
      }
    });
  }, false);
}());
