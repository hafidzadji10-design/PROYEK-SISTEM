let socket;
let reconnectTimer;
let manualFan = false;
let manualLed = false;

const $ = id => document.getElementById(id);

function connectToEsp32() {
  // Buka dashboard menggunakan alamat ESP32, misalnya http://192.168.1.50
  const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${wsProtocol}//${location.host}/ws`;

  socket = new WebSocket(wsUrl);

  socket.addEventListener("open", () => {
    $("connectionStatus").textContent = "Terhubung ke ESP32";
    $("connectionDot").className = "dot connected";
    clearTimeout(reconnectTimer);
  });

  socket.addEventListener("message", event => {
    try {
      handleEsp32Data(JSON.parse(event.data));
    } catch (error) {
      console.error("Data ESP32 tidak valid:", error);
    }
  });

  socket.addEventListener("close", () => {
    $("connectionStatus").textContent = "Terputus — mencoba menyambung...";
    $("connectionDot").className = "dot disconnected";
    reconnectTimer = setTimeout(connectToEsp32, 2000);
  });

  socket.addEventListener("error", () => socket.close());
}

function handleEsp32Data(data) {
  if (data.temperature !== undefined) {
    $("temperature").textContent = `${Number(data.temperature).toFixed(1)}°C`;
    $("chartTempValue").textContent = `${Number(data.temperature).toFixed(1)}°C`;
  }

  if (data.humidity !== undefined) {
    $("humidity").textContent = `${Math.round(data.humidity)}%`;
    $("chartHumidityValue").textContent = `${Math.round(data.humidity)}%`;
  }

  if (data.rfidCount !== undefined) {
    $("rfidCount").textContent = data.rfidCount;
  }

  if (data.touchCount !== undefined) {
    $("touchCount").textContent = data.touchCount;
  }

  if (data.fan !== undefined) {
    $("fanStatus").textContent = data.fan ? "MENYALA" : "MATI";
    if (!manualFan) $("fanToggle").checked = Boolean(data.fan);
  }

  if (data.led !== undefined) {
    $("ledStatus").textContent = data.led ? "Menyala" : "Mati";
    if (!manualLed) $("ledToggle").checked = Boolean(data.led);
  }

  if (data.motion !== undefined) {
    $("motionStatus").textContent = data.motion ? "Gerakan terdeteksi" : "Tidak ada gerakan";
  }

  if (data.event) addHistory(data.event);
}

function sendCommand(command, value) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    $("connectionStatus").textContent = "ESP32 belum terhubung";
    return;
  }

  socket.send(JSON.stringify({ command, value }));
}

function addHistory(event) {
  const body = $("historyBody");

  if (body.querySelector(".empty-row")) body.innerHTML = "";

  const row = document.createElement("tr");
  const values = [
    new Date().toLocaleTimeString("id-ID"),
    event.sensor || "ESP32",
    event.activity || "Aktivitas terdeteksi",
    event.status || "Berhasil"
  ];

  values.forEach((value, index) => {
    const cell = document.createElement("td");

    if (index === 3) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = value;
      cell.appendChild(badge);
    } else {
      cell.textContent = value;
    }

    row.appendChild(cell);
  });

  body.prepend(row);
  while (body.rows.length > 20) body.deleteRow(body.rows.length - 1);
}

$("fanToggle").addEventListener("change", event => {
  manualFan = true;
  sendCommand("fan", event.target.checked);
});

$("ledToggle").addEventListener("change", event => {
  manualLed = true;
  sendCommand("led", event.target.checked);
});

$("clearHistory").addEventListener("click", () => {
  $("historyBody").innerHTML =
    '<tr><td colspan="4" class="empty-row">Riwayat tampilan dihapus.</td></tr>';
});

connectToEsp32();