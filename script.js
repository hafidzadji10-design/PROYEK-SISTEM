"use strict";

/*
 * Jika halaman dan ESP32 berada di jaringan yang sama:
 *   ESP32_URL = "http://192.168.1.50"
 *
 * Ganti alamat IP di bawah dengan alamat ESP32 Anda.
 * Endpoint yang digunakan:
 *   GET  http://IP-ESP32/api/status
 *   POST http://IP-ESP32/api/control
 */
const ESP32_URL = "http://192.168.1.50";
const POLL_INTERVAL_MS = 2000;

const elements = {
  connectionDot: document.getElementById("connectionDot"),
  connectionStatus: document.getElementById("connectionStatus"),
  temperature: document.getElementById("temperature"),
  humidity: document.getElementById("humidity"),
  rfidCount: document.getElementById("rfidCount"),
  touchCount: document.getElementById("touchCount"),
  fanToggle: document.getElementById("fanToggle"),
  fanStatus: document.getElementById("fanStatus"),
  ledToggle: document.getElementById("ledToggle"),
  ledStatus: document.getElementById("ledStatus"),
  motionStatus: document.getElementById("motionStatus"),
  motionIndicator: document.getElementById("motionIndicator"),
  chartTempValue: document.getElementById("chartTempValue"),
  chartHumidityValue: document.getElementById("chartHumidityValue"),
  historyBody: document.getElementById("historyBody"),
  lastUpdated: document.getElementById("lastUpdated"),
  clearHistory: document.getElementById("clearHistory")
};

let isConnected = false;
let requestInProgress = false;

function setConnection(connected, message) {
  isConnected = connected;
  elements.connectionStatus.textContent = message;
  elements.connectionDot.classList.toggle("connected", connected);
  elements.connectionDot.classList.toggle("disconnected", !connected);

  // Jangan izinkan kontrol sebelum ESP32 berhasil dihubungi.
  elements.fanToggle.disabled = !connected;
  elements.ledToggle.disabled = !connected;
}

function formatTemperature(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(1)}°C` : "--.-°C";
}

function formatHumidity(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number)}%` : "--%";
}

function setSwitchState(input, value) {
  if (typeof value === "boolean") {
    input.checked = value;
  } else if (value === 1 || value === "ON" || value === "on") {
    input.checked = true;
  } else if (value === 0 || value === "OFF" || value === "off") {
    input.checked = false;
  }
}

function renderHistory(history) {
  if (!Array.isArray(history) || history.length === 0) {
    elements.historyBody.innerHTML = `
      <tr><td colspan="4" class="empty-row">Belum ada riwayat aktivitas.</td></tr>
    `;
    return;
  }

  // Batasi jumlah baris agar tabel tetap ringan.
  const rows = history.slice(-30).reverse();

  elements.historyBody.innerHTML = rows.map((item) => {
    const time = escapeHtml(item.time ?? item.timestamp ?? "--");
    const sensor = escapeHtml(item.sensor ?? item.type ?? "Sensor");
    const activity = escapeHtml(item.activity ?? item.message ?? "--");
    const status = escapeHtml(item.status ?? "Berhasil");

    return `
      <tr>
        <td>${time}</td>
        <td>${sensor}</td>
        <td>${activity}</td>
        <td><span class="status-tag">${status}</span></td>
      </tr>
    `;
  }).join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const replacements = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return replacements[character];
  });
}

function updateDashboard(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Format data status tidak valid.");
  }

  if (data.temperature !== undefined) {
    elements.temperature.innerHTML =
      `${Number(data.temperature).toFixed(1)}<small>°C</small>`;
    elements.chartTempValue.textContent = formatTemperature(data.temperature);
  }

  if (data.humidity !== undefined) {
    elements.humidity.innerHTML =
      `${Math.round(Number(data.humidity))}<small>%</small>`;
    elements.chartHumidityValue.textContent = formatHumidity(data.humidity);
  }

  if (data.rfidCount !== undefined) {
    elements.rfidCount.textContent = String(data.rfidCount);
  }

  if (data.touchCount !== undefined) {
    elements.touchCount.textContent = String(data.touchCount);
  }

  if (data.fan !== undefined) {
    setSwitchState(elements.fanToggle, data.fan);
  }

  elements.fanStatus.textContent = elements.fanToggle.checked
    ? "MENYALA"
    : "MATI";

  if (data.led !== undefined) {
    setSwitchState(elements.ledToggle, data.led);
  }

  elements.ledStatus.textContent = elements.ledToggle.checked
    ? "MENYALA"
    : "MATI";

  if (data.motion !== undefined) {
    const motionDetected =
      data.motion === true ||
      data.motion === 1 ||
      data.motion === "1" ||
      data.motion === "detected";

    elements.motionStatus.textContent = motionDetected
      ? "Gerakan terdeteksi"
      : "Tidak ada gerakan";

    elements.motionIndicator.classList.toggle("active", motionDetected);
  }

  if (Array.isArray(data.history)) {
    renderHistory(data.history);
  }

  elements.lastUpdated.textContent =
    `Diperbarui ${new Date().toLocaleTimeString("id-ID")}`;
}

async function fetchStatus() {
  if (requestInProgress) return;
  requestInProgress = true;

  try {
    const response = await fetch(`${ESP32_URL}/api/status`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    updateDashboard(data);
    setConnection(true, "Terhubung ke ESP32");
  } catch (error) {
    setConnection(false, "ESP32 tidak terhubung");
    console.error("Gagal mengambil status ESP32:", error);
  } finally {
    requestInProgress = false;
  }
}

async function sendControl(device, enabled) {
  if (!isConnected) {
    alert("ESP32 belum terhubung.");
    return false;
  }

  try {
    const response = await fetch(`${ESP32_URL}/api/control`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ [device]: enabled }),
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // Ambil status terbaru setelah perintah dikirim.
    await fetchStatus();
    return true;
  } catch (error) {
    console.error(`Gagal mengubah ${device}:`, error);
    setConnection(false, "Gagal mengirim kontrol");
    return false;
  }
}

elements.fanToggle.addEventListener("change", async (event) => {
  const requestedState = event.target.checked;
  const success = await sendControl("fan", requestedState);

  if (!success) {
    event.target.checked = !requestedState;
    elements.fanStatus.textContent = event.target.checked ? "MENYALA" : "MATI";
  }
});

elements.ledToggle.addEventListener("change", async (event) => {
  const requestedState = event.target.checked;
  const success = await sendControl("led", requestedState);

  if (!success) {
    event.target.checked = !requestedState;
    elements.ledStatus.textContent = event.target.checked ? "MENYALA" : "MATI";
  }
});

elements.clearHistory.addEventListener("click", () => {
  elements.historyBody.innerHTML = `
    <tr><td colspan="4" class="empty-row">
      Tampilan riwayat dikosongkan. Data di ESP32 tidak dihapus.
    </td></tr>
  `;
});

// Ambil data saat halaman dibuka, lalu perbarui berkala.
fetchStatus();
setInterval(fetchStatus, POLL_INTERVAL_MS);
