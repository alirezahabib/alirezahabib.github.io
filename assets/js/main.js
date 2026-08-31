(function () {
  "use strict";

  const BRAIN_CLICK_COUNT = 3;
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

  function easeInOutCubic(value) {
    return value < 0.5
      ? 4 * value * value * value
      : 1 - Math.pow(-2 * value + 2, 3) / 2;
  }

  function mix(start, end, amount) {
    return start + (end - start) * amount;
  }

  function animateBrainOutline(particles) {
    if (particles.__brainAnimating) {
      return;
    }

    const allParticles = particles.particles.array;
    const missingCount = Math.max(0, BRAIN_POINTS.length - allParticles.length);

    if (missingCount) {
      particles.fn.modes.pushParticles(missingCount);
    }

    const completeArray = particles.particles.array;
    const brainParticles = completeArray.slice(-BRAIN_POINTS.length);
    const pixelRatio = particles.canvas.pxratio || 1;
    const brainWidth = Math.min(particles.canvas.w * 0.78, 420 * pixelRatio);
    const brainHeight = brainWidth * 0.72;
    const centerX = particles.canvas.w * 0.5;
    const centerY = Math.min(particles.canvas.h * 0.35, 285 * pixelRatio);
    const targetRadius = 4 * pixelRatio;
    const originalMoveState = particles.particles.move.enable;
    const originalLinkDistance = particles.particles.line_linked.distance;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const morphDuration = reducedMotion ? 180 : 1050;
    const holdDuration = reducedMotion ? 500 : 1350;
    const returnDuration = reducedMotion ? 180 : 850;
    const originalStates = brainParticles.map(function (particle) {
      return {
        x: particle.x,
        y: particle.y,
        vx: particle.vx,
        vy: particle.vy,
        radius: particle.radius,
        opacity: particle.opacity
      };
    });
    const targets = BRAIN_POINTS.map(function (point) {
      return {
        x: centerX + (point[0] - 0.5) * brainWidth,
        y: centerY + (point[1] - 0.5) * brainHeight
      };
    });
    let startTime = 0;

    particles.__brainAnimating = true;
    particles.particles.move.enable = false;
    particles.particles.array = brainParticles;
    particles.particles.line_linked.distance = brainWidth * 0.105;

    function restoreParticles() {
      brainParticles.forEach(function (particle, index) {
        const original = originalStates[index];
        particle.x = original.x;
        particle.y = original.y;
        particle.vx = original.vx;
        particle.vy = original.vy;
        particle.radius = original.radius;
        particle.opacity = original.opacity;
      });
      particles.particles.array = completeArray;
      particles.particles.line_linked.distance = originalLinkDistance;
      particles.particles.move.enable = originalMoveState;
      particles.__brainAnimating = false;

      if (originalMoveState) {
        particles.fn.vendors.draw();
      } else {
        particles.fn.particlesDraw();
      }
    }

    function drawFrame(time) {
      if (!startTime) {
        startTime = time;
      }

      const elapsed = time - startTime;
      const morphEnd = morphDuration;
      const holdEnd = morphEnd + holdDuration;
      const returnEnd = holdEnd + returnDuration;
      let amount;

      if (elapsed < morphEnd) {
        amount = easeInOutCubic(elapsed / morphDuration);
      } else if (elapsed < holdEnd) {
        amount = 1;
      } else if (elapsed < returnEnd) {
        amount = 1 - easeInOutCubic((elapsed - holdEnd) / returnDuration);
      } else {
        restoreParticles();
        return;
      }

      brainParticles.forEach(function (particle, index) {
        const original = originalStates[index];
        const target = targets[index];
        particle.x = mix(original.x, target.x, amount);
        particle.y = mix(original.y, target.y, amount);
        particle.radius = mix(original.radius, targetRadius, amount);
        particle.opacity = mix(original.opacity, 0.78, amount);
        particle.vx = 0;
        particle.vy = 0;
      });

      particles.fn.particlesDraw();
      window.requestAnimationFrame(drawFrame);
    }

    window.requestAnimationFrame(drawFrame);
  }

  function enableBrainClicks(particles) {
    const canvas = particles.canvas.el;
    let clickCount = 0;

    if (!document.querySelector(".particles-canvas-hint")) {
      return;
    }

    canvas.addEventListener("click", function () {
      if (particles.__brainAnimating) {
        return;
      }

      clickCount += 1;
      if (clickCount >= BRAIN_CLICK_COUNT) {
        clickCount = 0;
        animateBrainOutline(particles);
      }
    });
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
      cursor.style.transform = "translate3d(" + event.clientX + "px," + event.clientY + "px,0)";
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
        enableBrainClicks(particles.pJS);
      }
    });
  }, false);
}());
