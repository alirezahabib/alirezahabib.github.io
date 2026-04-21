var moon =
  '<svg width="24px" height="24px" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="#000000"><path d="M12 18a6 6 0 100-12 6 6 0 000 12zM22 12h1M12 2V1M12 23v-1M20 20l-1-1M20 4l-1 1M4 20l1-1M4 4l1 1M1 12h1" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
var sun =
  '<svg width="24px" height="24px" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="#000000"><path d="M3 11.507a9.493 9.493 0 0018 4.219c-8.507 0-12.726-4.22-12.726-12.726A9.494 9.494 0 003 11.507z" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>';

const STORAGE_KEY = "theme";
const systemInitiatedDark = window.matchMedia("(prefers-color-scheme: dark)");

function getStoredTheme() {
  const theme = localStorage.getItem(STORAGE_KEY);
  return theme === "dark" || theme === "light" ? theme : null;
}

function resolveTheme() {
  const storedTheme = getStoredTheme();
  if (storedTheme) {
    return storedTheme;
  }
  return systemInitiatedDark.matches ? "dark" : "light";
}

function updateToggleIcon(activeTheme) {
  const toggle = document.getElementById("theme-toggle");
  if (!toggle) {
    return;
  }
  toggle.innerHTML = activeTheme === "dark" ? sun : moon;
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  updateToggleIcon(theme);
}

function modeSwitcher() {
  const currentTheme = document.documentElement.getAttribute("data-theme") || resolveTheme();
  const nextTheme = currentTheme === "dark" ? "light" : "dark";

  localStorage.setItem(STORAGE_KEY, nextTheme);
  applyTheme(nextTheme);
}

systemInitiatedDark.addEventListener("change", function (event) {
  if (getStoredTheme() !== null) {
    return;
  }
  applyTheme(event.matches ? "dark" : "light");
});

applyTheme(resolveTheme());
