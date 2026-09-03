(function () {
  "use strict";

  function enhanceParticleField(particles) {
    const canvas = particles.canvas.el;

    particles.interactivity.events.onclick.enable = false;
    canvas.addEventListener("click", function (event) {
      const canvasRect = canvas.getBoundingClientRect();
      const ratioX = particles.canvas.w / canvasRect.width;
      const ratioY = particles.canvas.h / canvasRect.height;
      const clickPosition = {
        x: (event.clientX - canvasRect.left) * ratioX,
        y: (event.clientY - canvasRect.top) * ratioY
      };
      particles.fn.modes.pushParticles(4, {
        pos_x: clickPosition.x,
        pos_y: clickPosition.y
      });
      particles.__neuralStimulus = clickPosition;
    });
  }

  function enableNeuralSpikes(particles) {
    const originalParticlesDraw = particles.fn.particlesDraw;
    const activeSpikes = [];
    const flashingNodes = new Map();
    const neuronStates = new Map();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const spikeColor = "116, 192, 252";
    const transmissionProbability = reducedMotion ? 0.32 : 0.47;
    let lastStateUpdate = performance.now();
    let nextSpontaneousFire = performance.now() + 450;

    function distanceBetween(first, second) {
      const deltaX = first.x - second.x;
      const deltaY = first.y - second.y;
      return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    }

    function connectedNeighbors(node, previousNode) {
      const connectionDistance = particles.particles.line_linked.distance * 0.96;
      return particles.particles.array
        .filter(function (candidate) {
          return candidate !== node
            && candidate !== previousNode
            && distanceBetween(node, candidate) <= connectionDistance;
        })
        .sort(function (first, second) {
          return distanceBetween(node, first) - distanceBetween(node, second);
        })
        .slice(0, 7);
    }

    function neuronState(node) {
      if (!neuronStates.has(node)) {
        neuronStates.set(node, {
          potential: Math.random() * 0.34,
          threshold: 0.86 + Math.random() * 0.24,
          refractoryUntil: 0
        });
      }
      return neuronStates.get(node);
    }

    function decayMembranePotentials(time) {
      const elapsed = Math.min(100, Math.max(0, time - lastStateUpdate));
      const decay = Math.exp(-elapsed / 1450);

      neuronStates.forEach(function (state) {
        state.potential *= decay;
      });
      lastStateUpdate = time;
    }

    function flashNode(node, time, intensity) {
      flashingNodes.set(node, {
        startTime: time,
        intensity: intensity
      });
    }

    function startSpike(from, to, time) {
      if (!from || !to || activeSpikes.length >= 12) {
        return;
      }

      activeSpikes.push({
        from: from,
        to: to,
        startTime: time,
        duration: 175 + Math.min(190, distanceBetween(from, to) * 0.72)
      });
    }

    function fireNeuron(node, sourceNode, time) {
      const state = neuronState(node);
      const neighbors = connectedNeighbors(node, sourceNode)
        .slice(0, reducedMotion ? 4 : 6);

      if (time < state.refractoryUntil) {
        return false;
      }

      state.potential = 0;
      state.refractoryUntil = time + 520 + Math.random() * 240;
      flashNode(node, time, 1);

      neighbors.forEach(function (neighbor) {
        if (Math.random() < transmissionProbability) {
          startSpike(node, neighbor, time + Math.random() * 45);
        }
      });
      return true;
    }

    function receiveSynapticInput(node, amount, sourceNode, time) {
      const state = neuronState(node);

      if (time < state.refractoryUntil) {
        return;
      }

      state.potential = Math.min(1.7, state.potential + amount);
      if (state.potential >= state.threshold) {
        fireNeuron(node, sourceNode, time);
      }
    }

    function stimulateNearest(position, time) {
      let nearestNode = null;
      let nearestDistance = Infinity;

      particles.particles.array.forEach(function (particle) {
        const distance = Math.hypot(particle.x - position.x, particle.y - position.y);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestNode = particle;
        }
      });

      if (nearestNode) {
        const state = neuronState(nearestNode);
        receiveSynapticInput(nearestNode, state.threshold + 0.08, null, time);
      }
    }

    function fireSpontaneously(time) {
      const particlesWithConnections = particles.particles.array.filter(function (particle) {
        return connectedNeighbors(particle, null).length > 0;
      });

      if (particlesWithConnections.length) {
        const neuron = particlesWithConnections[Math.floor(Math.random() * particlesWithConnections.length)];
        const state = neuronState(neuron);
        receiveSynapticInput(neuron, state.threshold + 0.04, null, time);
      }

      const meanInterval = reducedMotion ? 2300 : 1050;
      nextSpontaneousFire = time + 350 - Math.log(Math.max(0.001, Math.random())) * meanInterval;
    }

    function drawTravelingSpike(context, spike, progress, pixelRatio) {
      const trailProgress = Math.max(0, progress - 0.24);
      const startX = spike.from.x + (spike.to.x - spike.from.x) * trailProgress;
      const startY = spike.from.y + (spike.to.y - spike.from.y) * trailProgress;
      const endX = spike.from.x + (spike.to.x - spike.from.x) * progress;
      const endY = spike.from.y + (spike.to.y - spike.from.y) * progress;
      const gradient = context.createLinearGradient(startX, startY, endX, endY);
      const energy = Math.sin(progress * Math.PI) * 0.35 + 0.65;

      gradient.addColorStop(0, "rgba(" + spikeColor + ", 0)");
      gradient.addColorStop(0.58, "rgba(" + spikeColor + ", " + (0.38 * energy) + ")");
      gradient.addColorStop(1, "rgba(241, 243, 245, " + (0.95 * energy) + ")");

      context.strokeStyle = gradient;
      context.lineWidth = 1.7 * pixelRatio;
      context.lineCap = "round";
      context.shadowColor = "rgba(" + spikeColor + ", 0.9)";
      context.shadowBlur = 7 * pixelRatio;
      context.beginPath();
      context.moveTo(startX, startY);
      context.lineTo(endX, endY);
      context.stroke();

      context.fillStyle = "rgba(241, 243, 245, 0.95)";
      context.beginPath();
      context.arc(endX, endY, 1.9 * pixelRatio, 0, Math.PI * 2);
      context.fill();
    }

    function drawNodeFlashes(context, time, pixelRatio) {
      flashingNodes.forEach(function (flash, node) {
        const progress = (time - flash.startTime) / 330;

        if (progress >= 1) {
          flashingNodes.delete(node);
          return;
        }

        const energy = (1 - progress) * flash.intensity;
        const pulseRadius = node.radius + (3 + progress * 8) * pixelRatio;
        context.fillStyle = "rgba(241, 243, 245, " + (0.74 * energy) + ")";
        context.shadowColor = "rgba(" + spikeColor + ", 0.95)";
        context.shadowBlur = 12 * pixelRatio * energy;
        context.beginPath();
        context.arc(node.x, node.y, Math.max(node.radius, 2.2 * pixelRatio), 0, Math.PI * 2);
        context.fill();

        context.strokeStyle = "rgba(" + spikeColor + ", " + (0.48 * energy) + ")";
        context.lineWidth = 1.15 * pixelRatio;
        context.beginPath();
        context.arc(node.x, node.y, pulseRadius, 0, Math.PI * 2);
        context.stroke();
      });
    }

    function drawNeuralActivity() {
      const time = performance.now();
      const context = particles.canvas.ctx;
      const pixelRatio = particles.canvas.pxratio || 1;
      const survivingSpikes = [];
      const arrivals = [];

      decayMembranePotentials(time);

      if (particles.__neuralStimulus) {
        stimulateNearest(particles.__neuralStimulus, time);
        particles.__neuralStimulus = null;
      }

      if (!document.hidden && time >= nextSpontaneousFire && activeSpikes.length < 6) {
        fireSpontaneously(time);
      }

      context.save();
      context.globalCompositeOperation = "lighter";

      activeSpikes.forEach(function (spike) {
        const progress = (time - spike.startTime) / spike.duration;

        if (progress >= 1) {
          arrivals.push(spike);
          return;
        }

        if (progress >= 0) {
          drawTravelingSpike(context, spike, progress, pixelRatio);
        }
        survivingSpikes.push(spike);
      });

      activeSpikes.length = 0;
      Array.prototype.push.apply(activeSpikes, survivingSpikes);
      arrivals.forEach(function (spike) {
        flashNode(spike.to, time, 0.3);
        receiveSynapticInput(
          spike.to,
          0.48 + Math.random() * 0.58,
          spike.from,
          time
        );
      });

      drawNodeFlashes(context, time, pixelRatio);
      context.restore();
    }

    particles.fn.particlesDraw = function () {
      originalParticlesDraw();
      drawNeuralActivity();
    };
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
        enhanceParticleField(particles.pJS);
        enableNeuralSpikes(particles.pJS);
      }
    });
  }, false);
}());
