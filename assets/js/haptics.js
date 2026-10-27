/*
 * Safari tap adapter adapted from ios-haptics 3.3.0 by tijn.
 * https://github.com/tijnjh/ios-haptics (584eb496ef3f22eb8e639be2e6726ad3411c773a)
 * MIT license: /assets/licenses/ios-haptics.txt
 */
(function () {
  "use strict";

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let lastPulse = -Infinity;

  function attach(element) {
    if (!isIOS || !element) {
      return null;
    }

    const existing = element.querySelector(":scope > [data-haptic-trigger]");
    if (existing) {
      return existing;
    }

    const input = document.createElement("input");
    if (!("switch" in input)) {
      return null;
    }

    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    Object.assign(input.style, {
      position: "absolute",
      width: "1px",
      height: "1px",
      margin: "0",
      visibility: "hidden"
    });

    // A real label tap forwards a trusted click to Safari's native switch.
    // Keeping the switch out of the hit area lets gestures still scroll.
    const label = document.createElement("label");
    label.setAttribute("data-haptic-trigger", "");
    label.setAttribute("aria-hidden", "true");
    Object.assign(label.style, {
      position: "absolute",
      inset: "0",
      margin: "0",
      zIndex: "1",
      borderRadius: "inherit",
      cursor: "inherit",
      touchAction: "manipulation"
    });
    label.style.setProperty("-webkit-tap-highlight-color", "transparent");

    // Don't run the host's action twice when the label activates the switch.
    input.addEventListener("click", function (event) {
      event.stopPropagation();
    });
    label.appendChild(input);
    if (getComputedStyle(element).position === "static") {
      element.style.position = "relative";
    }
    element.appendChild(label);
    return label;
  }

  // Duration-based feedback is only available with the Vibration API.
  // Safari uses the native label tap above; no synthetic clicks or timers.
  function pulse(duration) {
    const now = performance.now();
    if (isIOS || typeof navigator.vibrate !== "function"
        || document.hidden || now - lastPulse < 70) {
      return false;
    }
    lastPulse = now;
    return navigator.vibrate(Math.round(duration));
  }

  window.siteHaptics = { attach: attach, pulse: pulse };
})();
