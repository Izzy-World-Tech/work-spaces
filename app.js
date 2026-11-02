(function () {
  "use strict";

  const STORAGE_KEY = "plantly-plants-v1";
  const THEME_KEY = "plantly-theme-v1";
  const ALERT_KEY = "plantly-alert-logs-v1";
  const DEFAULT_PLANTS = [
    {
      id: "demo-monstera",
      name: "Monstera",
      intervalDays: 4,
      icon: "🌿",
      iconSource: "emoji",
      lastWatered: Date.now() - 1000 * 60 * 60 * 24 * 3,
    },
    {
      id: "demo-snake",
      name: "Snake Plant",
      intervalDays: 7,
      icon: "🌵",
      iconSource: "emoji",
      lastWatered: Date.now() - 1000 * 60 * 60 * 24 * 2,
    }
  ];

  const plantForm = document.getElementById("plant-form");
  const plantList = document.getElementById("plant-list");
  const seedDemoButton = document.getElementById("seed-demo");
  const plantSummary = document.getElementById("plant-summary");
  const iconUpload = document.getElementById("icon-upload");
  const uploadPreview = document.getElementById("upload-preview");
  const iconOptions = Array.from(document.querySelectorAll(".icon-option"));
  const themeToggle = document.getElementById("theme-toggle");
  const notificationToggle = document.getElementById("notification-toggle");

  let selectedIcon = "🌱";
  let uploadedIconUrl = "";

  function readJson(key, fallback) {
    try {
      const saved = localStorage.getItem(key);
      return saved === null ? fallback : JSON.parse(saved);
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Ignore localStorage issues in restricted browser contexts.
    }
  }

  function applyTheme(themeName) {
    const isDark = themeName === "dark";
    document.body.classList.toggle("dark-mode", isDark);
    themeToggle.textContent = isDark ? "☀️ Light mode" : "🌙 Dark mode";
    writeJson(THEME_KEY, themeName);
  }

  function setupTheme() {
    const savedTheme = readJson(THEME_KEY, "light");
    applyTheme(savedTheme === "dark" ? "dark" : "light");
    themeToggle.addEventListener("click", () => {
      const nextTheme = document.body.classList.contains("dark-mode") ? "light" : "dark";
      applyTheme(nextTheme);
    });
  }

  function updateNotificationToggle() {
    if (!("Notification" in window)) {
      notificationToggle.textContent = "Browser unsupported";
      notificationToggle.disabled = true;
      return;
    }

    if (Notification.permission === "granted") {
      notificationToggle.textContent = "Reminders on";
    } else if (Notification.permission === "denied") {
      notificationToggle.textContent = "Reminders blocked";
    } else {
      notificationToggle.textContent = "Enable reminders";
    }
  }

  function requestNotifications() {
    if (!("Notification" in window)) {
      return false;
    }

    if (Notification.permission === "granted") {
      updateNotificationToggle();
      return true;
    }

    if (Notification.permission === "denied") {
      updateNotificationToggle();
      return false;
    }

    Notification.requestPermission().then((permission) => {
      updateNotificationToggle();
      return permission === "granted";
    });

    return true;
  }

  notificationToggle.addEventListener("click", () => {
    requestNotifications();
  });

  function readPlants() {
    const saved = readJson(STORAGE_KEY, null);
    if (!saved) return DEFAULT_PLANTS;
    return Array.isArray(saved) && saved.length ? saved : DEFAULT_PLANTS;
  }

  function writePlants(plants) {
    writeJson(STORAGE_KEY, plants);
  }

  function getPlantIcon(plant) {
    if (plant.iconSource === "upload" && plant.icon) {
      return "<img src=\"" + plant.icon + "\" alt=\"" + plant.name + " plant icon\" />";
    }
    return plant.icon || "🌱";
  }

  function getCountdownParts(msUntilWater) {
    const totalSeconds = Math.max(0, Math.floor(msUntilWater / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return { days, hours, minutes, totalSeconds };
  }

  function formatCountdown(plant) {
    const nextWaterMs = getNextWaterTime(plant) - Date.now();

    if (nextWaterMs <= 0) {
      return { display: "Due now", overdue: true };
    }

    const { days, hours, minutes } = getCountdownParts(nextWaterMs);
    return {
      display: days > 0 ? days + "d " + hours + "h" : hours > 0 ? hours + "h " + minutes + "m" : minutes + "m",
      overdue: false
    };
  }

  function getNextWaterTime(plant) {
    return plant.lastWatered + plant.intervalDays * 24 * 60 * 60 * 1000;
  }

  function updateSummary(plants) {
    const overdueCount = plants.filter((plant) => getNextWaterTime(plant) <= Date.now()).length;
    const label = plants.length === 1 ? "1 plant" : plants.length + " plants";
    plantSummary.textContent = overdueCount ? label + " • " + overdueCount + " due" : label;
  }

  function getAlertLog() {
    return readJson(ALERT_KEY, {});
  }

  function writeAlertLog(log) {
    writeJson(ALERT_KEY, log);
  }

  function triggerOverdueAlerts() {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return;
    }

    const plants = readPlants();
    const log = getAlertLog();
    const now = Date.now();

    plants.forEach((plant) => {
      const dueAt = getNextWaterTime(plant);
      if (dueAt > now) return;

      const prevAlert = Number(log[plant.id] || 0);
      const cooldownMs = 1000 * 60 * 60 * 2;
      if (prevAlert && now - prevAlert < cooldownMs) return;

      const message = plant.name + " is overdue for watering.";
      new Notification("Plantly reminder", {
        body: message,
        tag: plant.id,
      });

      log[plant.id] = now;
    });

    writeAlertLog(log);
  }

  function renderPlants() {
    const plants = readPlants();
    updateSummary(plants);
    triggerOverdueAlerts();

    if (!plants.length) {
      plantList.innerHTML = '<div class="empty-state">No plants yet. Add your first leafy friend to get started.</div>';
      return;
    }

    const cards = plants
      .map((plant) => {
        const countdown = formatCountdown(plant);
        const overdue = countdown.overdue;
        const nextWaterTime = getNextWaterTime(plant);
        const iconMarkup = getPlantIcon(plant);

        return `
          <article class="plant-card ${overdue ? "overdue" : ""}">
            <div class="plant-top">
              <div class="plant-main">
                <div class="plant-icon">${iconMarkup}</div>
                <div>
                  <h3 class="plant-name">${escapeHtml(plant.name)}</h3>
                  <p class="plant-subtitle">Every ${plant.intervalDays} days</p>
                </div>
              </div>
              <span class="plant-status ${overdue ? "overdue" : "safe"}">${overdue ? "Needs water" : "On track"}</span>
            </div>

            <div class="timer-row ${overdue ? "overdue" : ""}">
              <div>
                <p class="timer-label">Next watering</p>
                <p class="timer-value">${countdown.display}</p>
              </div>
              <div>
                <p class="timer-label">Last watered</p>
                <p class="timer-value">${formatDateShort(plant.lastWatered)}</p>
              </div>
            </div>

            <div class="plant-actions">
              <button type="button" class="plant-action" data-action="water" data-id="${plant.id}">Watered</button>
              <button type="button" class="plant-action danger" data-action="delete" data-id="${plant.id}">Delete</button>
            </div>
          </article>
        `;
      })
      .join("");

    plantList.innerHTML = cards;

    document.querySelectorAll("[data-action='water']").forEach((button) => {
      button.addEventListener("click", (event) => {
        const id = event.currentTarget.dataset.id;
        waterPlant(id);
      });
    });

    document.querySelectorAll("[data-action='delete']").forEach((button) => {
      button.addEventListener("click", (event) => {
        const id = event.currentTarget.dataset.id;
        deletePlant(id);
      });
    });
  }

  function formatDateShort(timestamp) {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric"
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function waterPlant(id) {
    const plants = readPlants();
    const nextPlants = plants.map((plant) => {
      if (plant.id === id) {
        return { ...plant, lastWatered: Date.now() };
      }
      return plant;
    });
    writePlants(nextPlants);
    renderPlants();
  }

  function deletePlant(id) {
    const plants = readPlants().filter((plant) => plant.id !== id);
    writePlants(plants);
    renderPlants();
  }

  function getSelectedIcon() {
    if (uploadedIconUrl) {
      return { value: uploadedIconUrl, source: "upload" };
    }
    return { value: selectedIcon, source: "emoji" };
  }

  function handleFormSubmit(event) {
    event.preventDefault();

    const formData = new FormData(plantForm);
    const name = String(formData.get("plantName") || "").trim();
    const intervalDays = Number(formData.get("wateringInterval"));

    if (!name || !Number.isFinite(intervalDays) || intervalDays < 1) {
      return;
    }

    const { value, source } = getSelectedIcon();

    const plants = readPlants();
    const newPlant = {
      id: "plant-" + Date.now() + "-" + Math.random().toString(16).slice(2),
      name,
      intervalDays,
      icon: value,
      iconSource: source,
      lastWatered: Date.now()
    };

    writePlants([newPlant, ...plants]);
    plantForm.reset();
    selectedIcon = "🌱";
    uploadedIconUrl = "";
    uploadPreview.innerHTML = "";
    iconOptions.forEach((option) => option.classList.toggle("selected", option.dataset.icon === selectedIcon));
    document.getElementById("watering-interval").value = 3;
    renderPlants();
  }

  function handleIconSelection(event) {
    const button = event.currentTarget;
    selectedIcon = button.dataset.icon;
    uploadedIconUrl = "";
    uploadPreview.innerHTML = "";
    iconUpload.value = "";
    iconOptions.forEach((option) => option.classList.toggle("selected", option === button));
  }

  function handleUpload(event) {
    const [file] = event.target.files;
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function () {
      uploadedIconUrl = String(reader.result || "");
      uploadPreview.innerHTML = '<img src="' + uploadedIconUrl + '" alt="Uploaded plant icon preview" />';
      iconOptions.forEach((option) => option.classList.remove("selected"));
    };
    reader.readAsDataURL(file);
  }

  iconOptions.forEach((button) => {
    button.addEventListener("click", handleIconSelection);
  });

  iconUpload.addEventListener("change", handleUpload);
  seedDemoButton.addEventListener("click", () => {
    writePlants(DEFAULT_PLANTS);
    renderPlants();
  });
  plantForm.addEventListener("submit", handleFormSubmit);

  setupTheme();
  updateNotificationToggle();

  renderPlants();
  setInterval(renderPlants, 1000 * 30);
})();
