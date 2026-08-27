(function () {
  "use strict";

  const STEP = 1 / 60;
  const GRAVITY = 1050;
  const DAMPING = 0.982;
  const CONSTRAINT_PASSES = 18;
  const DRAG_CONSTRAINT_PASSES = 80;

  function initializeRoadmapPendulum() {
    const list = document.querySelector(".roadmap-list");
    const canvas = list && list.querySelector(".roadmap-pendulum");
    const icons = list ? Array.from(list.querySelectorAll(".roadmap-doodle")) : [];

    if (!list || !canvas || icons.length !== 4) {
      return;
    }

    icons.forEach(function (icon) {
      const imprint = icon.cloneNode(true);
      imprint.classList.add("roadmap-doodle-imprint");
      imprint.setAttribute("aria-hidden", "true");
      imprint.removeAttribute("aria-label");
      imprint.removeAttribute("role");
      imprint.removeAttribute("tabindex");
      icon.parentNode.insertBefore(imprint, icon);
    });

    const context = canvas.getContext("2d");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let nodes = [];
    let links = [];
    let width = 0;
    let height = 0;
    let dragging = null;
    let frame = null;
    let previousTime = 0;
    let accumulator = 0;
    let quietFrames = 0;
    let resizeTimer = null;
    let gravityX = 0;
    let gravityY = GRAVITY;
    let orientationListening = false;
    let orientationPermissionRequested = false;

    function measure() {
      if (dragging) {
        return;
      }

      icons.forEach(function (icon) {
        icon.style.setProperty("--pendulum-x", "0px");
        icon.style.setProperty("--pendulum-y", "0px");
      });

      const fieldRect = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = fieldRect.width;
      height = fieldRect.height;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      nodes = icons.map(function (icon, index) {
        const rect = icon.getBoundingClientRect();
        const x = rect.left - fieldRect.left + rect.width / 2;
        const y = rect.top - fieldRect.top + rect.height / 2;

        return {
          index: index,
          x: x,
          y: y,
          previousX: x,
          previousY: y,
          restX: x,
          restY: y,
          halfWidth: rect.width / 2,
          halfHeight: rect.height / 2,
        };
      });

      links = nodes.slice(1).map(function (node, index) {
        const previousNode = nodes[index];
        return Math.hypot(node.x - previousNode.x, node.y - previousNode.y);
      });

      render();
      drawLinks();
    }

    function canvasPoint(event) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    }

    function clampNode(node) {
      const padding = 4;
      node.x = Math.max(node.halfWidth + padding, Math.min(width - node.halfWidth - padding, node.x));
      node.y = Math.max(node.halfHeight + padding, Math.min(height - node.halfHeight - padding, node.y));
    }

    function clampDraggedReach(index) {
      if (index === 0) {
        return;
      }

      const anchor = nodes[0];
      const node = nodes[index];
      const relevantLinks = links.slice(0, index);
      const maximumReach = relevantLinks.reduce(function (total, length) {
        return total + length;
      }, 0);
      const longestLink = Math.max.apply(null, relevantLinks);
      const minimumReach = Math.max(0, longestLink - (maximumReach - longestLink));
      let deltaX = node.x - anchor.x;
      let deltaY = node.y - anchor.y;
      let distance = Math.hypot(deltaX, deltaY);

      if (distance < 0.0001) {
        deltaX = node.restX - anchor.restX;
        deltaY = node.restY - anchor.restY;
        distance = Math.max(Math.hypot(deltaX, deltaY), 0.0001);
      }
      const constrainedDistance = Math.max(minimumReach, Math.min(maximumReach, distance));

      if (Math.abs(constrainedDistance - distance) < 0.001) {
        return;
      }

      node.x = anchor.x + deltaX / distance * constrainedDistance;
      node.y = anchor.y + deltaY / distance * constrainedDistance;
    }

    function moveDraggedNode(event) {
      if (!dragging || event.pointerId !== dragging.pointerId) {
        return;
      }

      const point = canvasPoint(event);
      const node = nodes[dragging.index];
      node.previousX = node.x;
      node.previousY = node.y;
      node.x = point.x + dragging.offsetX;
      node.y = point.y + dragging.offsetY;
      clampNode(node);
      clampDraggedReach(dragging.index);
      solveConstraints(DRAG_CONSTRAINT_PASSES);
      render();
      drawLinks();
      startAnimation();
    }

    function isFixed(index) {
      return index === 0 || (dragging && dragging.index === index);
    }

    function solveConstraints(passes) {
      const passCount = passes || CONSTRAINT_PASSES;

      for (let pass = 0; pass < passCount; pass += 1) {
        for (let index = 0; index < links.length; index += 1) {
          const first = nodes[index];
          const second = nodes[index + 1];
          const deltaX = second.x - first.x;
          const deltaY = second.y - first.y;
          const distance = Math.max(Math.hypot(deltaX, deltaY), 0.0001);
          const correction = (distance - links[index]) / distance;
          const firstFixed = isFixed(index);
          const secondFixed = isFixed(index + 1);

          if (firstFixed && secondFixed) {
            if (dragging && dragging.index === index + 1) {
              second.x = first.x + deltaX / distance * links[index];
              second.y = first.y + deltaY / distance * links[index];
            }
            continue;
          }

          if (firstFixed) {
            second.x -= deltaX * correction;
            second.y -= deltaY * correction;
          } else if (secondFixed) {
            first.x += deltaX * correction;
            first.y += deltaY * correction;
          } else {
            const halfCorrection = correction * 0.5;
            first.x += deltaX * halfCorrection;
            first.y += deltaY * halfCorrection;
            second.x -= deltaX * halfCorrection;
            second.y -= deltaY * halfCorrection;
          }
        }
      }
    }

    function simulate() {
      for (let index = 1; index < nodes.length; index += 1) {
        if (dragging && dragging.index === index) {
          continue;
        }

        const node = nodes[index];
        const velocityX = (node.x - node.previousX) * DAMPING;
        const velocityY = (node.y - node.previousY) * DAMPING;
        node.previousX = node.x;
        node.previousY = node.y;
        node.x += velocityX + gravityX * STEP * STEP;
        node.y += velocityY + gravityY * STEP * STEP;
      }

      solveConstraints();
    }

    function render() {
      nodes.forEach(function (node, index) {
        icons[index].style.setProperty("--pendulum-x", node.x - node.restX + "px");
        icons[index].style.setProperty("--pendulum-y", node.y - node.restY + "px");
      });
    }

    function edgeDistance(node, unitX, unitY) {
      const horizontal = Math.abs(unitX) > 0.0001
        ? node.halfWidth / Math.abs(unitX)
        : Infinity;
      const vertical = Math.abs(unitY) > 0.0001
        ? node.halfHeight / Math.abs(unitY)
        : Infinity;
      const boundary = Math.min(horizontal, vertical);

      // The campus artwork has transparent corners inside its rectangular SVG.
      // Let the rod continue behind it so it meets the drawn building at any angle.
      return node.index === 1 ? boundary * 0.58 : boundary;
    }

    function drawHint() {
      if (nodes.length < 4 || width < 420) {
        return;
      }

      const target = nodes[3];
      const endX = target.restX - target.halfWidth - 10;
      const endY = target.restY - 2;
      const startX = Math.max(18, endX - 132);
      const startY = endY - 62;
      const textColor = getComputedStyle(list).getPropertyValue("--color-link").trim();

      context.save();
      context.strokeStyle = textColor;
      context.fillStyle = textColor;
      context.globalAlpha = 0.82;
      context.lineWidth = 2;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.setLineDash([]);
      context.font = "italic 15px Piazzolla, serif";
      context.fillText("drag me!", startX + 3, startY - 10);

      context.beginPath();
      context.moveTo(startX + 8, startY);
      context.bezierCurveTo(startX + 58, startY - 24, startX + 70, startY + 34, startX + 33, startY + 38);
      context.bezierCurveTo(startX - 2, startY + 42, startX + 5, startY + 3, startX + 45, startY + 10);
      context.bezierCurveTo(startX + 88, startY + 18, startX + 73, startY + 59, startX + 48, startY + 48);
      context.bezierCurveTo(startX + 31, startY + 40, startX + 65, startY + 38, endX, endY);
      context.stroke();

      context.beginPath();
      context.moveTo(endX - 11, endY - 7);
      context.lineTo(endX, endY);
      context.lineTo(endX - 11, endY + 6);
      context.stroke();
      context.restore();
    }

    function drawLinks() {
      context.clearRect(0, 0, width, height);
      context.save();
      context.strokeStyle = getComputedStyle(list).getPropertyValue("--color-text").trim();
      context.globalAlpha = 0.26;
      context.lineWidth = 2;
      context.lineCap = "round";
      context.setLineDash([6, 6]);

      links.forEach(function (_length, index) {
        const first = nodes[index];
        const second = nodes[index + 1];
        const deltaX = second.x - first.x;
        const deltaY = second.y - first.y;
        const distance = Math.max(Math.hypot(deltaX, deltaY), 0.0001);
        const unitX = deltaX / distance;
        const unitY = deltaY / distance;
        const firstEdge = edgeDistance(first, unitX, unitY);
        const secondEdge = edgeDistance(second, unitX, unitY);

        context.beginPath();
        context.moveTo(first.x + unitX * firstEdge, first.y + unitY * firstEdge);
        context.lineTo(second.x - unitX * secondEdge, second.y - unitY * secondEdge);
        context.stroke();

        context.setLineDash([]);
        context.beginPath();
        context.moveTo(first.x + unitX * firstEdge, first.y + unitY * firstEdge);
        context.lineTo(first.x + unitX * (firstEdge + 12), first.y + unitY * (firstEdge + 12));
        context.moveTo(second.x - unitX * secondEdge, second.y - unitY * secondEdge);
        context.lineTo(second.x - unitX * (secondEdge + 12), second.y - unitY * (secondEdge + 12));
        context.stroke();
        context.setLineDash([6, 6]);
      });

      context.restore();
      drawHint();
    }

    function motionLevel() {
      let amount = 0;

      for (let index = 1; index < nodes.length; index += 1) {
        amount += Math.abs(nodes[index].x - nodes[index].previousX);
        amount += Math.abs(nodes[index].y - nodes[index].previousY);
      }

      return amount;
    }

    function animate(time) {
      if (!previousTime) {
        previousTime = time;
      }

      accumulator += Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;

      while (accumulator >= STEP) {
        simulate();
        accumulator -= STEP;
      }

      render();
      drawLinks();

      if (!dragging && motionLevel() < 0.035) {
        quietFrames += 1;
      } else {
        quietFrames = 0;
      }

      if (quietFrames > 45 || (reducedMotion.matches && !dragging)) {
        frame = null;
        previousTime = 0;
        accumulator = 0;
        return;
      }

      frame = window.requestAnimationFrame(animate);
    }

    function startAnimation() {
      quietFrames = 0;
      if (frame === null) {
        previousTime = 0;
        accumulator = 0;
        frame = window.requestAnimationFrame(animate);
      }
    }

    function screenOrientationAngle() {
      if (window.screen.orientation && typeof window.screen.orientation.angle === "number") {
        return window.screen.orientation.angle;
      }

      return typeof window.orientation === "number" ? window.orientation : 0;
    }

    function applyDeviceOrientation(event) {
      if (typeof event.beta !== "number" || typeof event.gamma !== "number") {
        return;
      }

      const beta = event.beta * Math.PI / 180;
      const gamma = event.gamma * Math.PI / 180;
      const deviceX = Math.sin(gamma) * Math.cos(beta);
      const deviceY = Math.sin(beta);
      const screenAngle = screenOrientationAngle() * Math.PI / 180;
      const cosine = Math.cos(screenAngle);
      const sine = Math.sin(screenAngle);
      const targetX = GRAVITY * (deviceX * cosine + deviceY * sine);
      const targetY = GRAVITY * (-deviceX * sine + deviceY * cosine);
      const nextX = gravityX + (targetX - gravityX) * 0.18;
      const nextY = gravityY + (targetY - gravityY) * 0.18;

      if (Math.abs(nextX - gravityX) < 0.35 && Math.abs(nextY - gravityY) < 0.35) {
        return;
      }

      gravityX = nextX;
      gravityY = nextY;
      startAnimation();
    }

    function listenForDeviceOrientation() {
      if (orientationListening) {
        return;
      }

      orientationListening = true;
      window.addEventListener("deviceorientation", applyDeviceOrientation, true);
    }

    function requestDeviceOrientation() {
      if (orientationPermissionRequested || typeof window.DeviceOrientationEvent === "undefined") {
        return;
      }

      orientationPermissionRequested = true;
      const permissionRequest = window.DeviceOrientationEvent.requestPermission;

      if (typeof permissionRequest !== "function") {
        listenForDeviceOrientation();
        return;
      }

      permissionRequest.call(window.DeviceOrientationEvent)
        .then(function (permission) {
          if (permission === "granted") {
            listenForDeviceOrientation();
          }
        })
        .catch(function () {
          // Keep ordinary downward gravity when sensor access is unavailable.
        });
    }

    function finishDrag(event) {
      if (!dragging || event.pointerId !== dragging.pointerId) {
        return;
      }

      if (event.type === "pointerup") {
        requestDeviceOrientation();
      }

      const icon = icons[dragging.index];
      icon.classList.remove("is-dragging");
      icon.setAttribute("aria-grabbed", "false");
      dragging = null;
      solveConstraints();
      nodes.forEach(function (node) {
        node.previousX = node.x;
        node.previousY = node.y;
      });
      render();
      drawLinks();
      startAnimation();
    }

    icons.forEach(function (icon, index) {
      if (index === 0) {
        return;
      }

      icon.setAttribute("aria-grabbed", "false");

      icon.addEventListener("pointerdown", function (event) {
        event.preventDefault();
        const point = canvasPoint(event);
        const node = nodes[index];
        dragging = {
          index: index,
          pointerId: event.pointerId,
          offsetX: node.x - point.x,
          offsetY: node.y - point.y,
        };
        icon.setPointerCapture(event.pointerId);
        icon.classList.add("is-dragging");
        icon.setAttribute("aria-grabbed", "true");
        startAnimation();
      });

      icon.addEventListener("pointermove", moveDraggedNode);
      icon.addEventListener("pointerup", finishDrag);
      icon.addEventListener("pointercancel", finishDrag);
      icon.addEventListener("lostpointercapture", finishDrag);

      icon.addEventListener("keydown", function (event) {
        const movement = 14;
        const directions = {
          ArrowLeft: [-movement, 0],
          ArrowRight: [movement, 0],
          ArrowUp: [0, -movement],
          ArrowDown: [0, movement],
        };

        if (!directions[event.key]) {
          return;
        }

        event.preventDefault();
        const node = nodes[index];
        node.previousX = node.x;
        node.previousY = node.y;
        node.x += directions[event.key][0];
        node.y += directions[event.key][1];
        clampNode(node);
        clampDraggedReach(index);
        solveConstraints(DRAG_CONSTRAINT_PASSES);
        nodes.forEach(function (currentNode) {
          currentNode.previousX = currentNode.x;
          currentNode.previousY = currentNode.y;
        });
        render();
        drawLinks();
        startAnimation();
      });
    });

    const themeObserver = new MutationObserver(drawLinks);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    window.addEventListener("resize", function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(measure, 120);
    });

    measure();
    if (typeof window.DeviceOrientationEvent !== "undefined"
        && typeof window.DeviceOrientationEvent.requestPermission !== "function") {
      listenForDeviceOrientation();
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(measure);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeRoadmapPendulum);
  } else {
    initializeRoadmapPendulum();
  }
})();
