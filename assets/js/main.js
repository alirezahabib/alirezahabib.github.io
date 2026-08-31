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

    particles.particles.number.value = BRAIN_POINTS.length;
    particles.particles.number.density.enable = false;
    particles.particles.move.enable = false;

    function ensureBrainParticles() {
      const particleArray = particles.particles.array;
      const missingCount = Math.max(0, BRAIN_POINTS.length - particleArray.length);

      if (missingCount) {
        particles.fn.modes.pushParticles(missingCount);
      }

      if (!particles.__brainReady && particles.particles.array.length > BRAIN_POINTS.length) {
        particles.particles.array.splice(BRAIN_POINTS.length);
      }

      particles.__brainReady = true;
      return particles.particles.array.slice(0, BRAIN_POINTS.length);
    }

    function drawBrain(time) {
      const brainParticles = ensureBrainParticles();
      const canvasRect = particles.canvas.el.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      const ratioX = particles.canvas.w / canvasRect.width;
      const ratioY = particles.canvas.h / canvasRect.height;
      const spaceAbove = Math.max(80, frameRect.top - canvasRect.top);
      const brainWidth = Math.min(
        frameRect.width,
        canvasRect.width * 0.46,
        spaceAbove * 1.15
      ) * ratioX;
      const brainHeight = brainWidth * 0.72;
      const centerX = (frameRect.left + frameRect.width / 2 - canvasRect.left) * ratioX;
      const centerY = Math.max(
        brainHeight / 2 + 7 * ratioY,
        (frameRect.top - canvasRect.top) * ratioY - brainHeight / 2 - 10 * ratioY
      );
      const targetRadius = 2.35 * ratioX;
      const wobble = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1.2 * ratioX;

      particles.particles.line_linked.distance = brainWidth * 0.16;

      brainParticles.forEach(function (particle, index) {
        const point = BRAIN_POINTS[index];
        const phase = index * 0.73;
        particle.x = centerX + ((point[0] - 0.5) / 0.8) * brainWidth
          + Math.sin(time / 1100 + phase) * wobble;
        particle.y = centerY + ((point[1] - 0.51) / 0.82) * brainHeight
          + Math.cos(time / 1250 + phase) * wobble;
        particle.radius = targetRadius;
        particle.opacity = 0.72;
        particle.vx = 0;
        particle.vy = 0;
      });

      particles.particles.array.slice(BRAIN_POINTS.length).forEach(function (particle) {
        particle.radius = Math.min(particle.radius, 4.5 * ratioX);
      });

      particles.fn.particlesDraw();
      window.requestAnimationFrame(drawBrain);
    }

    window.requestAnimationFrame(drawBrain);
  }

  function enableAppleEasterEgg() {
    const trigger = document.querySelector(".apple-easter-trigger");

    if (!trigger) {
      return;
    }

    const cursor = document.createElement("span");
    let timeout = null;
    cursor.className = "classic-mac-pointer";
    cursor.setAttribute("aria-hidden", "true");
    document.body.appendChild(cursor);

    function moveCursor(event) {
      cursor.style.transform = "translate3d(" + (event.clientX - 13) + "px," + (event.clientY - 8) + "px,0)";
    }

    function deactivate() {
      window.clearTimeout(timeout);
      timeout = null;
      document.documentElement.classList.remove("classic-mac-cursor");
      trigger.classList.remove("is-active");
      trigger.setAttribute("aria-pressed", "false");
      cursor.classList.remove("is-visible");
      window.removeEventListener("pointermove", moveCursor);
    }

    function activate(event) {
      if (timeout) {
        deactivate();
        return;
      }

      moveCursor(event);
      document.documentElement.classList.add("classic-mac-cursor");
      trigger.classList.add("is-active");
      trigger.setAttribute("aria-pressed", "true");
      cursor.classList.add("is-visible");
      window.addEventListener("pointermove", moveCursor);
      timeout = window.setTimeout(deactivate, 7000);
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
