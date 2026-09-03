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
    const plasticConnections = new Map();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const spikeColor = "116, 192, 252";
    const restingTransmissionProbability = reducedMotion ? 0.2 : 0.3;
    const maximumActiveSpikes = reducedMotion ? 9 : 30;
    const cofireWindow = 360;
    let nextNeuronId = 1;
    let lastStateUpdate = performance.now();
    let networkBurst = null;
    let quietUntil = 0;
    let nextSpontaneousFire = performance.now() + 650;

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
          id: nextNeuronId,
          potential: Math.random() * 0.24,
          threshold: 0.82 + Math.random() * 0.24,
          refractoryUntil: 0,
          lastFiredAt: -Infinity
        });
        nextNeuronId += 1;
      }
      return neuronStates.get(node);
    }

    function connectionKey(first, second) {
      const firstId = neuronState(first).id;
      const secondId = neuronState(second).id;
      return firstId < secondId
        ? firstId + ":" + secondId
        : secondId + ":" + firstId;
    }

    function decayConnection(connection, time) {
      const elapsed = Math.max(0, time - connection.updatedAt);
      connection.strength *= Math.exp(-elapsed / 28000);
      connection.updatedAt = time;
    }

    function strengthenConnection(first, second, time, synchrony) {
      const key = connectionKey(first, second);
      let connection = plasticConnections.get(key);

      if (!connection) {
        connection = {
          first: first,
          second: second,
          strength: 0,
          updatedAt: time
        };
        plasticConnections.set(key, connection);
      } else {
        decayConnection(connection, time);
      }

      connection.strength = Math.min(
        1,
        connection.strength + 0.1 + synchrony * 0.16
      );
    }

    function connectionStrength(first, second, time) {
      const connection = plasticConnections.get(connectionKey(first, second));

      if (!connection) {
        return 0;
      }

      decayConnection(connection, time);
      return connection.strength;
    }

    function decayMembranePotentials(time) {
      const elapsed = Math.min(100, Math.max(0, time - lastStateUpdate));
      const decay = Math.exp(-elapsed / 1100);

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
      if (!from || !to || activeSpikes.length >= maximumActiveSpikes) {
        return;
      }

      activeSpikes.push({
        from: from,
        to: to,
        startTime: time,
        duration: 145 + Math.min(165, distanceBetween(from, to) * 0.62)
      });
    }

    function burstStrength(time) {
      if (!networkBurst) {
        return 0;
      }

      const progress = (time - networkBurst.startTime)
        / (networkBurst.endTime - networkBurst.startTime);
      return Math.max(0, Math.min(1, 1 - progress));
    }

    function fireNeuron(node, sourceNode, time) {
      const state = neuronState(node);
      const nearbyNeurons = connectedNeighbors(node, null);
      const neighbors = nearbyNeurons
        .filter(function (neighbor) {
          return neighbor !== sourceNode;
        })
        .slice(0, reducedMotion ? 4 : 6);

      if (time < state.refractoryUntil) {
        return false;
      }

      const strength = burstStrength(time);
      const refractoryPeriod = strength > 0
        ? 165 + Math.random() * 125
        : 430 + Math.random() * 190;
      const transmissionProbability = restingTransmissionProbability
        + strength * (reducedMotion ? 0.16 : 0.38);

      nearbyNeurons.forEach(function (neighbor) {
        const timeApart = time - neuronState(neighbor).lastFiredAt;

        if (timeApart >= 0 && timeApart <= cofireWindow) {
          strengthenConnection(
            node,
            neighbor,
            time,
            1 - timeApart / cofireWindow
          );
        }
      });

      state.potential = 0;
      state.refractoryUntil = time + refractoryPeriod;
      state.lastFiredAt = time;
      flashNode(node, time, 1);

      neighbors.forEach(function (neighbor, index) {
        const distanceBias = 1 - index / (neighbors.length * 1.7);
        const learnedBoost = connectionStrength(node, neighbor, time) * 0.2;
        if (Math.random() < (transmissionProbability + learnedBoost) * distanceBias) {
          startSpike(node, neighbor, time + Math.random() * 45);
        }
      });
      return true;
    }

    function receiveSynapticInput(node, amount, sourceNode, time) {
      const state = neuronState(node);

      if (time < state.refractoryUntil || (!networkBurst && time < quietUntil)) {
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
        startNetworkBurst(nearestNode, time);
      }
    }

    function connectedNeuron() {
      const particlesWithConnections = particles.particles.array.filter(function (particle) {
        return connectedNeighbors(particle, null).length > 0;
      });

      if (particlesWithConnections.length) {
        return particlesWithConnections[Math.floor(Math.random() * particlesWithConnections.length)];
      }

      return null;
    }

    function startNetworkBurst(origin, time) {
      const seed = origin || connectedNeuron();

      if (!seed) {
        nextSpontaneousFire = time + 900;
        return;
      }

      const nearbyPacemakers = connectedNeighbors(seed, null)
        .slice(0, reducedMotion ? 1 : 2);
      const duration = reducedMotion
        ? 720
        : 1250 + Math.random() * 850;

      networkBurst = {
        startTime: time,
        endTime: time + duration,
        pacemakers: [seed].concat(nearbyPacemakers),
        nextPulseTime: time,
        pulseIndex: 0
      };
      quietUntil = 0;
    }

    function pulseNetworkBurst(time) {
      const pacemaker = networkBurst.pacemakers[
        networkBurst.pulseIndex % networkBurst.pacemakers.length
      ];
      const state = neuronState(pacemaker);

      receiveSynapticInput(pacemaker, state.threshold + 0.08, null, time);
      networkBurst.pulseIndex += 1;
      networkBurst.nextPulseTime = time + (reducedMotion
        ? 320 + Math.random() * 120
        : 95 + Math.random() * 105);
    }

    function finishNetworkBurst(time) {
      networkBurst = null;
      quietUntil = time + (reducedMotion
        ? 4200 + Math.random() * 2200
        : 2400 + Math.random() * 3300);
      nextSpontaneousFire = quietUntil;
    }

    function fireSpontaneously(time) {
      startNetworkBurst(null, time);

      if (!networkBurst) {
        nextSpontaneousFire = time + 900;
      }
    }

    function applyHebbianAttraction(time) {
      const activeNeurons = new Set(particles.particles.array);
      const preferredDistance = particles.particles.line_linked.distance * 0.48;
      const maximumDistance = particles.particles.line_linked.distance * 1.25;
      const pixelRatio = particles.canvas.pxratio || 1;

      plasticConnections.forEach(function (connection, key) {
        decayConnection(connection, time);

        if (connection.strength < 0.025
          || !activeNeurons.has(connection.first)
          || !activeNeurons.has(connection.second)) {
          plasticConnections.delete(key);
          return;
        }

        const deltaX = connection.second.x - connection.first.x;
        const deltaY = connection.second.y - connection.first.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (distance <= 0 || distance > maximumDistance || reducedMotion) {
          return;
        }

        const displacement = distance - preferredDistance;
        const shift = Math.max(
          -0.055 * pixelRatio,
          Math.min(0.055 * pixelRatio, displacement * 0.00055 * connection.strength)
        );
        const unitX = deltaX / distance;
        const unitY = deltaY / distance;

        connection.first.x += unitX * shift;
        connection.first.y += unitY * shift;
        connection.second.x -= unitX * shift;
        connection.second.y -= unitY * shift;
      });
    }

    function drawStrengthenedConnections(context, pixelRatio) {
      const visibleDistance = particles.particles.line_linked.distance * 1.08;

      plasticConnections.forEach(function (connection) {
        const distance = distanceBetween(connection.first, connection.second);
        const proximity = Math.max(0, 1 - distance / visibleDistance);

        if (proximity <= 0) {
          return;
        }

        const opacity = (0.08 + connection.strength * 0.5)
          * (0.42 + proximity * 0.58);
        context.strokeStyle = "rgba(" + spikeColor + ", " + opacity + ")";
        context.lineWidth = (0.45 + connection.strength * 1.15) * pixelRatio;
        context.lineCap = "round";
        context.shadowColor = "rgba(" + spikeColor + ", " + (connection.strength * 0.62) + ")";
        context.shadowBlur = 5 * pixelRatio * connection.strength;
        context.beginPath();
        context.moveTo(connection.first.x, connection.first.y);
        context.lineTo(connection.second.x, connection.second.y);
        context.stroke();
      });
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

    function drawNeuralActivity(time) {
      const context = particles.canvas.ctx;
      const pixelRatio = particles.canvas.pxratio || 1;
      const survivingSpikes = [];
      const arrivals = [];

      decayMembranePotentials(time);

      if (particles.__neuralStimulus) {
        stimulateNearest(particles.__neuralStimulus, time);
        particles.__neuralStimulus = null;
      }

      if (networkBurst && time >= networkBurst.endTime) {
        finishNetworkBurst(time);
      }

      if (networkBurst
        && time >= networkBurst.nextPulseTime
        && activeSpikes.length < maximumActiveSpikes - 3) {
        pulseNetworkBurst(time);
      }

      if (!document.hidden && !networkBurst && time >= nextSpontaneousFire) {
        fireSpontaneously(time);
      }

      context.save();
      context.globalCompositeOperation = "lighter";
      drawStrengthenedConnections(context, pixelRatio);

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
          (0.56 + Math.random() * 0.62) * (0.82 + burstStrength(time) * 0.3),
          spike.from,
          time
        );
      });

      drawNodeFlashes(context, time, pixelRatio);
      context.restore();
    }

    particles.fn.particlesDraw = function () {
      const time = performance.now();

      applyHebbianAttraction(time);
      originalParticlesDraw();
      drawNeuralActivity(time);
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
