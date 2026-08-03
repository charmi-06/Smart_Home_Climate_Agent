/**
 * Smart Home Climate Agent Simulation
 * Handles thermodynamics physics simulation, agent perceive-act loop,
 * real-time room canvas rendering, chart plotting, and UI state management.
 */

// --- State Variables ---
let isRunning = true;
let stepCounter = 0;
let agentType = 'goal'; // 'goal' or 'reflex'
let goalMode = 'comfort'; // 'comfort' (±0.5°C) or 'eco' (±1.2°C)

// Thermal Model
let roomTemp = 28.0;
let targetTemp = 22.0;
let ambientTemp = 34.0;
let occupants = 2;
let isWindowOpen = false;

let hvacState = 'OFF'; // 'OFF', 'COOLING', 'HEATING'
let hvacPower = 0.0;
let totalEnergyKWh = 0.0;
let switchCount = 0;

// Agent Memory State
let tempHistory = [];
let chartHistory = []; // Stores objects { time, roomTemp, targetTemp, ambientTemp, hvacState, upperLimit, lowerLimit }
const MAX_CHART_STEPS = 80;

// Fan Blade Animation Angle
let fanAngle = 0;

// Air Particles for Visual AC Airflow
const airParticles = [];
for (let i = 0; i < 25; i++) {
  airParticles.push({
    x: Math.random() * 180 + 200,
    y: Math.random() * 60 + 50,
    vx: (Math.random() - 0.5) * 1.5,
    vy: Math.random() * 1.5 + 1,
    size: Math.random() * 3 + 2,
    alpha: Math.random()
  });
}

// --- DOM Elements ---
const simPlayPauseBtn = document.getElementById('simPlayPauseBtn');
const simPlayIcon = document.getElementById('simPlayIcon');
const simPlayText = document.getElementById('simPlayText');
const simResetBtn = document.getElementById('simResetBtn');

const valRoomTemp = document.getElementById('valRoomTemp');
const valTargetTemp = document.getElementById('valTargetTemp');
const valAmbientTemp = document.getElementById('valAmbientTemp');
const valHVACState = document.getElementById('valHVACState');
const valHVACPower = document.getElementById('valHVACPower');
const valEnergy = document.getElementById('valEnergy');
const valCycles = document.getElementById('valCycles');
const subTempTrend = document.getElementById('subTempTrend');
const subGoalTolerance = document.getElementById('subGoalTolerance');

const sliderTargetTemp = document.getElementById('sliderTargetTemp');
const dispTargetTemp = document.getElementById('dispTargetTemp');
const sliderAmbientTemp = document.getElementById('sliderAmbientTemp');
const dispAmbientTemp = document.getElementById('dispAmbientTemp');
const sliderOccupants = document.getElementById('sliderOccupants');
const dispOccupants = document.getElementById('dispOccupants');

const btnAgentGoal = document.getElementById('btnAgentGoal');
const btnAgentReflex = document.getElementById('btnAgentReflex');
const btnModeComfort = document.getElementById('btnModeComfort');
const btnModeEco = document.getElementById('btnModeEco');
const goalModeGroup = document.getElementById('goalModeGroup');

const cogSensorVal = document.getElementById('cogSensorVal');
const cogTrendVal = document.getElementById('cogTrendVal');
const cogGoalBand = document.getElementById('cogGoalBand');
const cogActionVal = document.getElementById('cogActionVal');
const rationaleBox = document.getElementById('rationaleBox');
const logConsole = document.getElementById('logConsole');
const agentStatusText = document.getElementById('agentStatusText');

// Canvas Contexts
const roomCanvas = document.getElementById('roomCanvas');
const roomCtx = roomCanvas.getContext('2d');
const chartCanvas = document.getElementById('chartCanvas');
const chartCtx = chartCanvas.getContext('2d');

// Adjust Canvas Sizes
function resizeCanvases() {
  const rRect = roomCanvas.parentElement.getBoundingClientRect();
  roomCanvas.width = rRect.width;
  roomCanvas.height = rRect.height;

  const cRect = chartCanvas.parentElement.getBoundingClientRect();
  chartCanvas.width = cRect.width;
  chartCanvas.height = cRect.height;
}
window.addEventListener('resize', resizeCanvases);

// --- Initialization ---
function init() {
  resizeCanvases();
  setupEventListeners();
  resetSimulation();
  requestAnimationFrame(loop);
}

// --- Event Listeners ---
function setupEventListeners() {
  simPlayPauseBtn.addEventListener('click', togglePlayPause);
  simResetBtn.addEventListener('click', resetSimulation);

  sliderTargetTemp.addEventListener('input', (e) => {
    targetTemp = parseFloat(e.target.value);
    dispTargetTemp.textContent = `${targetTemp.toFixed(1)}°C`;
    valTargetTemp.childNodes[0].nodeValue = `${targetTemp.toFixed(1)} `;
  });

  sliderAmbientTemp.addEventListener('input', (e) => {
    ambientTemp = parseFloat(e.target.value);
    dispAmbientTemp.textContent = `${ambientTemp.toFixed(1)}°C`;
    valAmbientTemp.childNodes[0].nodeValue = `${ambientTemp.toFixed(1)} `;
  });

  sliderOccupants.addEventListener('input', (e) => {
    occupants = parseInt(e.target.value, 10);
    dispOccupants.textContent = `${occupants} Persons`;
  });
}

function togglePlayPause() {
  isRunning = !isRunning;
  simPlayIcon.textContent = isRunning ? '⏸️' : '▶️';
  simPlayText.textContent = isRunning ? 'Pause' : 'Resume';
}

function setAgentType(type) {
  agentType = type;
  btnAgentGoal.classList.toggle('active', type === 'goal');
  btnAgentReflex.classList.toggle('active', type === 'reflex');
  goalModeGroup.style.opacity = type === 'goal' ? '1' : '0.4';
  goalModeGroup.style.pointerEvents = type === 'goal' ? 'auto' : 'none';

  agentStatusText.textContent = type === 'goal' ? 'Goal-Based Agent Active' : 'Simple Reflex Agent Active';
  logMessage('SYSTEM', `Switched agent architecture to: ${type === 'goal' ? 'Goal-Based Agent' : 'Simple Reflex Agent'}`);
}

function setGoalMode(mode) {
  goalMode = mode;
  btnModeComfort.classList.toggle('active', mode === 'comfort');
  btnModeEco.classList.toggle('active', mode === 'eco');
  subGoalTolerance.textContent = `Tolerance: ${mode === 'comfort' ? '±0.5°C' : '±1.2°C'}`;
  logMessage('GOAL', `Set goal tolerance mode to: ${mode.toUpperCase()} (${mode === 'comfort' ? '±0.5°C' : '±1.2°C'})`);
}

function setWindowOpen(isOpen) {
  isWindowOpen = isOpen;
  document.getElementById('btnWindowClosed').classList.toggle('active', !isOpen);
  document.getElementById('btnWindowOpen').classList.toggle('active', isOpen);
  logMessage('ENV', `Window ${isOpen ? 'Opened (high thermal transfer)' : 'Closed (insulated)'}`);
}

function resetSimulation() {
  stepCounter = 0;
  roomTemp = 28.0;
  targetTemp = parseFloat(sliderTargetTemp.value);
  ambientTemp = parseFloat(sliderAmbientTemp.value);
  hvacState = 'OFF';
  hvacPower = 0.0;
  totalEnergyKWh = 0.0;
  switchCount = 0;
  tempHistory = [];
  chartHistory = [];
  logConsole.innerHTML = '';
  logMessage('SYSTEM', 'Simulation reset. Initialized room temp to 28.0°C.');
}

// --- Thermal Physics Engine ---
function updatePhysics() {
  const dt_minutes = 1.0;
  const insulation = isWindowOpen ? 0.15 : 0.04;

  // Ambient heat exchange
  const ambientDelta = -insulation * (roomTemp - ambientTemp);

  // HVAC effect & Power usage
  let hvacDelta = 0.0;
  let powerKW = 0.0;
  const maxCoolingStep = 0.35;
  const maxHeatingStep = 0.30;

  if (hvacState === 'COOLING') {
    hvacDelta = -maxCoolingStep * hvacPower;
    powerKW = 2.5 * hvacPower;
  } else if (hvacState === 'HEATING') {
    hvacDelta = maxHeatingStep * hvacPower;
    powerKW = 2.0 * hvacPower;
  }

  totalEnergyKWh += powerKW * (dt_minutes / 60.0);

  // Body heat gains
  const internalGains = occupants * 0.025;

  // Sensor/Environmental Noise
  const noise = (Math.random() - 0.5) * 0.03;

  // New room temp
  roomTemp += (ambientDelta + hvacDelta + internalGains + noise);
}

// --- Agent Logic Loop ---
function stepAgent() {
  const tolerance = goalMode === 'comfort' ? 0.5 : 1.2;
  const upperLimit = targetTemp + tolerance;
  const lowerLimit = targetTemp - tolerance;

  // Percept Sensing with noise
  const sensorNoise = (Math.random() - 0.5) * 0.04;
  const sensedTemp = Math.round((roomTemp + sensorNoise) * 10) / 10;

  tempHistory.push(sensedTemp);
  if (tempHistory.length > 10) tempHistory.shift();

  // Compute trend
  let trendStr = "Stable";
  if (tempHistory.length >= 2) {
    const diff = tempHistory[tempHistory.length - 1] - tempHistory[tempHistory.length - 2];
    if (diff > 0.05) trendStr = `Warming (+${diff.toFixed(2)}°C)`;
    else if (diff < -0.05) trendStr = `Cooling (${diff.toFixed(2)}°C)`;
  }

  let nextState = hvacState;
  let power = 1.0;
  let rationale = "";

  if (agentType === 'goal') {
    // --- GOAL-BASED AGENT LOGIC (HYSTERESIS + GOAL TOLERANCE) ---
    if (hvacState === 'OFF') {
      if (sensedTemp > upperLimit) {
        nextState = 'COOLING';
        rationale = `Goal evaluated: Perceived temp (${sensedTemp}°C) > Upper goal limit (${upperLimit.toFixed(1)}°C). Triggering AC Cooling.`;
      } else if (sensedTemp < lowerLimit) {
        nextState = 'HEATING';
        rationale = `Goal evaluated: Perceived temp (${sensedTemp}°C) < Lower goal limit (${lowerLimit.toFixed(1)}°C). Triggering Heating.`;
      } else {
        rationale = `Goal evaluated: Temperature (${sensedTemp}°C) is comfortably within goal bounds [${lowerLimit.toFixed(1)}°C, ${upperLimit.toFixed(1)}°C]. Keeping HVAC OFF.`;
      }
    } else if (hvacState === 'COOLING') {
      if (sensedTemp <= targetTemp) {
        nextState = 'OFF';
        rationale = `Goal achieved: Room temperature (${sensedTemp}°C) reached target setpoint (${targetTemp.toFixed(1)}°C). Turning OFF cooling.`;
      } else {
        const diff = sensedTemp - targetTemp;
        power = Math.min(1.0, Math.max(0.4, diff / 2.0));
        rationale = `Goal in progress: Cooling room down to target ${targetTemp.toFixed(1)}°C. Diff: +${diff.toFixed(1)}°C. Modulating power to ${(power*100).toFixed(0)}%.`;
      }
    } else if (hvacState === 'HEATING') {
      if (sensedTemp >= targetTemp) {
        nextState = 'OFF';
        rationale = `Goal achieved: Room temperature (${sensedTemp}°C) reached target setpoint (${targetTemp.toFixed(1)}°C). Turning OFF heating.`;
      } else {
        const diff = targetTemp - sensedTemp;
        power = Math.min(1.0, Math.max(0.4, diff / 2.0));
        rationale = `Goal in progress: Heating room up to target ${targetTemp.toFixed(1)}°C. Diff: -${diff.toFixed(1)}°C. Modulating power to ${(power*100).toFixed(0)}%.`;
      }
    }
  } else {
    // --- SIMPLE REFLEX AGENT LOGIC (DIRECT RULE WITHOUT HYSTERESIS) ---
    if (sensedTemp > targetTemp) {
      nextState = 'COOLING';
      rationale = `Reflex Rule Matched: IF (T > Target) -> COOLING. (${sensedTemp}°C > ${targetTemp.toFixed(1)}°C)`;
    } else if (sensedTemp < targetTemp) {
      nextState = 'HEATING';
      rationale = `Reflex Rule Matched: IF (T < Target) -> HEATING. (${sensedTemp}°C < ${targetTemp.toFixed(1)}°C)`;
    } else {
      nextState = 'OFF';
      rationale = `Reflex Rule Matched: IF (T == Target) -> OFF.`;
    }
  }

  // Count compressor switches
  if (nextState !== hvacState) {
    switchCount++;
    logMessage(nextState, `HVAC state changed from ${hvacState} -> ${nextState} (Switch #${switchCount})`);
  }

  hvacState = nextState;
  hvacPower = power;

  // Update UI Elements
  valRoomTemp.childNodes[0].nodeValue = `${roomTemp.toFixed(1)} `;
  valHVACState.textContent = hvacState;
  valHVACState.style.color = hvacState === 'COOLING' ? 'var(--accent-cyan)' : (hvacState === 'HEATING' ? 'var(--accent-amber)' : 'var(--text-muted)');
  valHVACPower.textContent = `Compressor Power: ${hvacState === 'OFF' ? 0 : Math.round(power * 100)}%`;
  valEnergy.childNodes[0].nodeValue = `${totalEnergyKWh.toFixed(3)} `;
  valCycles.textContent = `AC Switches: ${switchCount}`;
  subTempTrend.textContent = trendStr;

  cogSensorVal.textContent = `${sensedTemp.toFixed(1)}°C`;
  cogTrendVal.textContent = trendStr;
  cogGoalBand.textContent = agentType === 'goal' ? `[${lowerLimit.toFixed(1)}°C - ${upperLimit.toFixed(1)}°C]` : `Exact ${targetTemp.toFixed(1)}°C`;
  cogActionVal.textContent = hvacState;
  cogActionVal.style.color = hvacState === 'COOLING' ? 'var(--accent-cyan)' : (hvacState === 'HEATING' ? 'var(--accent-amber)' : 'var(--text-muted)');
  rationaleBox.textContent = rationale;

  // Record for Timeline Chart
  chartHistory.push({
    time: stepCounter,
    roomTemp: roomTemp,
    targetTemp: targetTemp,
    ambientTemp: ambientTemp,
    hvacState: hvacState,
    upperLimit: upperLimit,
    lowerLimit: lowerLimit
  });

  if (chartHistory.length > MAX_CHART_STEPS) {
    chartHistory.shift();
  }
}

// --- Logger ---
function logMessage(tag, message) {
  const entry = document.createElement('div');
  entry.className = 'log-entry';

  const timeStr = String(Math.floor(stepCounter / 60)).padStart(2, '0') + ':' + String(stepCounter % 60).padStart(2, '0');
  let tagClass = 'off';
  if (tag === 'COOLING') tagClass = 'cool';
  if (tag === 'HEATING') tagClass = 'heat';

  entry.innerHTML = `
    <span class="log-time">${timeStr}</span>
    <span class="log-badge ${tagClass}">${tag}</span>
    <span>${message}</span>
  `;

  logConsole.appendChild(entry);
  logConsole.scrollTop = logConsole.scrollHeight;
}

// --- Main Simulation Loop ---
let lastStepTime = 0;
function loop(timestamp) {
  if (isRunning && timestamp - lastStepTime > 300) { // Step every 300ms
    lastStepTime = timestamp;
    stepCounter++;
    updatePhysics();
    stepAgent();
  }

  renderRoomCanvas();
  renderChartCanvas();

  requestAnimationFrame(loop);
}

// --- Visual Room Renderer ---
function renderRoomCanvas() {
  const w = roomCanvas.width;
  const h = roomCanvas.height;
  if (!w || !h) return;

  roomCtx.clearRect(0, 0, w, h);

  // 1. Thermal Atmosphere Background Glow
  // Cold (blue) vs Hot (amber/red)
  const normTemp = Math.max(0, Math.min(1, (roomTemp - 18) / 16));
  const bgGrad = roomCtx.createLinearGradient(0, 0, 0, h);
  const redComponent = Math.round(15 + normTemp * 40);
  const blueComponent = Math.round(60 - normTemp * 40);
  bgGrad.addColorStop(0, `rgb(${redComponent}, ${Math.round(23 + normTemp * 10)}, ${blueComponent})`);
  bgGrad.addColorStop(1, '#020617');
  roomCtx.fillStyle = bgGrad;
  roomCtx.fillRect(0, 0, w, h);

  // 2. Outdoor Window Scene
  const winX = w - 160;
  const winY = 30;
  const winW = 120;
  const winH = 100;
  
  // Outside Sky
  const skyGrad = roomCtx.createLinearGradient(winX, winY, winX, winY + winH);
  skyGrad.addColorStop(0, ambientTemp > 30 ? '#f59e0b' : '#38bdf8');
  skyGrad.addColorStop(1, '#020617');
  roomCtx.fillStyle = skyGrad;
  roomCtx.fillRect(winX, winY, winW, winH);

  // Sun
  roomCtx.beginPath();
  roomCtx.arc(winX + winW - 30, winY + 30, 16, 0, Math.PI * 2);
  roomCtx.fillStyle = '#fde047';
  roomCtx.fill();

  // Window Frame
  roomCtx.strokeStyle = 'rgba(255,255,255,0.4)';
  roomCtx.lineWidth = 4;
  roomCtx.strokeRect(winX, winY, winW, winH);
  roomCtx.beginPath();
  roomCtx.moveTo(winX + winW/2, winY); roomCtx.lineTo(winX + winW/2, winY + winH);
  roomCtx.moveTo(winX, winY + winH/2); roomCtx.lineTo(winX + winW, winY + winH/2);
  roomCtx.stroke();

  // Outdoor Temp Label on Window
  roomCtx.fillStyle = '#ffffff';
  roomCtx.font = '11px Inter, sans-serif';
  roomCtx.fillText(`Outdoor: ${ambientTemp.toFixed(1)}°C`, winX + 10, winY + winH - 8);

  // 3. Smart AC Unit (Top Left)
  const acX = 40;
  const acY = 30;
  const acW = 160;
  const acH = 55;

  // AC Body
  roomCtx.fillStyle = '#1e293b';
  roomCtx.strokeStyle = hvacState === 'COOLING' ? '#38bdf8' : (hvacState === 'HEATING' ? '#f59e0b' : '#475569');
  roomCtx.lineWidth = 2;
  roomCtx.beginPath();
  roomCtx.roundRect(acX, acY, acW, acH, 8);
  roomCtx.fill();
  roomCtx.stroke();

  // AC Vents
  roomCtx.fillStyle = '#0f172a';
  roomCtx.fillRect(acX + 15, acY + acH - 12, acW - 30, 6);

  // AC LED Display
  roomCtx.fillStyle = '#020617';
  roomCtx.fillRect(acX + acW - 45, acY + 12, 35, 18);
  roomCtx.fillStyle = hvacState === 'COOLING' ? '#38bdf8' : (hvacState === 'HEATING' ? '#f59e0b' : '#64748b');
  roomCtx.font = 'bold 11px monospace';
  roomCtx.fillText(`${roomTemp.toFixed(0)}°C`, acX + acW - 40, acY + 25);

  // Animated Fan Icon on AC
  fanAngle += (hvacState === 'OFF' ? 0.02 : 0.25);
  const fanCX = acX + 30;
  const fanCY = acY + 22;
  roomCtx.save();
  roomCtx.translate(fanCX, fanCY);
  roomCtx.rotate(fanAngle);
  roomCtx.strokeStyle = hvacState === 'OFF' ? '#64748b' : '#38bdf8';
  roomCtx.lineWidth = 2;
  for (let b = 0; b < 3; b++) {
    roomCtx.rotate((Math.PI * 2) / 3);
    roomCtx.beginPath();
    roomCtx.moveTo(0, 0);
    roomCtx.lineTo(0, -8);
    roomCtx.stroke();
  }
  roomCtx.restore();

  // 4. Airflow Animation Particles
  if (hvacState !== 'OFF') {
    airParticles.forEach(p => {
      p.y += p.vy * (hvacState === 'COOLING' ? 1 : 0.8);
      p.x += p.vx;
      if (p.y > h - 40 || p.x < 20 || p.x > w - 20) {
        p.x = acX + Math.random() * (acW - 30) + 15;
        p.y = acY + acH;
      }
      roomCtx.beginPath();
      roomCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      roomCtx.fillStyle = hvacState === 'COOLING' ? `rgba(56, 189, 248, ${p.alpha * 0.6})` : `rgba(245, 158, 11, ${p.alpha * 0.6})`;
      roomCtx.fill();
    });
  }

  // 5. Room Furniture Visuals (Sofa & Occupants)
  const sofaX = 140;
  const sofaY = h - 65;
  
  // Sofa
  roomCtx.fillStyle = '#334155';
  roomCtx.beginPath();
  roomCtx.roundRect(sofaX, sofaY, 140, 45, 8);
  roomCtx.fill();

  // Occupants (Stick figures / Avatars)
  for (let i = 0; i < occupants; i++) {
    const px = sofaX + 25 + i * 22;
    const py = sofaY - 10;

    // Head
    roomCtx.beginPath();
    roomCtx.arc(px, py, 7, 0, Math.PI * 2);
    roomCtx.fillStyle = '#38bdf8';
    roomCtx.fill();

    // Body
    roomCtx.fillStyle = '#94a3b8';
    roomCtx.fillRect(px - 5, py + 7, 10, 14);
  }

  // 6. Thermometer Display Widget (Bottom Right)
  const thermX = w - 60;
  const thermY = h - 140;
  const thermH = 100;

  roomCtx.fillStyle = 'rgba(15, 23, 42, 0.8)';
  roomCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  roomCtx.beginPath();
  roomCtx.roundRect(thermX - 15, thermY - 10, 40, thermH + 40, 10);
  roomCtx.fill();
  roomCtx.stroke();

  // Tube
  const liquidH = Math.max(10, Math.min(thermH, (roomTemp - 15) / 20 * thermH));
  roomCtx.fillStyle = '#475569';
  roomCtx.fillRect(thermX - 3, thermY, 6, thermH);

  // Liquid Column
  roomCtx.fillStyle = normTemp > 0.6 ? '#ef4444' : (normTemp < 0.3 ? '#38bdf8' : '#10b981');
  roomCtx.fillRect(thermX - 3, thermY + thermH - liquidH, 6, liquidH);

  // Bulb
  roomCtx.beginPath();
  roomCtx.arc(thermX, thermY + thermH + 8, 10, 0, Math.PI * 2);
  roomCtx.fill();

  roomCtx.fillStyle = '#ffffff';
  roomCtx.font = 'bold 11px Inter, sans-serif';
  roomCtx.fillText(`${roomTemp.toFixed(1)}°C`, thermX - 18, thermY - 16);
}

// --- Dynamic Real-Time Chart Renderer ---
function renderChartCanvas() {
  const w = chartCanvas.width;
  const h = chartCanvas.height;
  if (!w || !h) return;

  chartCtx.clearRect(0, 0, w, h);

  if (chartHistory.length < 2) {
    chartCtx.fillStyle = '#64748b';
    chartCtx.font = '14px Inter, sans-serif';
    chartCtx.fillText('Collecting simulation history...', 20, h / 2);
    return;
  }

  const paddingLeft = 45;
  const paddingBottom = 30;
  const paddingTop = 20;
  const paddingRight = 20;

  const chartW = w - paddingLeft - paddingRight;
  const chartH = h - paddingTop - paddingBottom;

  // Temperature Bounds
  const minTemp = 15.0;
  const maxTemp = 38.0;

  const getY = (t) => paddingTop + chartH - ((t - minTemp) / (maxTemp - minTemp)) * chartH;
  const getX = (index) => paddingLeft + (index / (MAX_CHART_STEPS - 1)) * chartW;

  // 1. Grid lines & Y-axis labels
  chartCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  chartCtx.lineWidth = 1;
  chartCtx.fillStyle = '#64748b';
  chartCtx.font = '10px Inter, sans-serif';

  for (let t = 16; t <= 36; t += 4) {
    const y = getY(t);
    chartCtx.beginPath();
    chartCtx.moveTo(paddingLeft, y);
    chartCtx.lineTo(w - paddingRight, y);
    chartCtx.stroke();
    chartCtx.fillText(`${t}°C`, 10, y + 3);
  }

  // 2. Shaded Hysteresis Goal Band (Green translucent window)
  if (agentType === 'goal') {
    const lastEntry = chartHistory[chartHistory.length - 1];
    const topY = getY(lastEntry.upperLimit);
    const botY = getY(lastEntry.lowerLimit);

    chartCtx.fillStyle = 'rgba(16, 185, 129, 0.15)';
    chartCtx.fillRect(paddingLeft, topY, chartW, botY - topY);

    chartCtx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
    chartCtx.setLineDash([4, 4]);
    chartCtx.beginPath();
    chartCtx.moveTo(paddingLeft, topY); chartCtx.lineTo(w - paddingRight, topY);
    chartCtx.moveTo(paddingLeft, botY); chartCtx.lineTo(w - paddingRight, botY);
    chartCtx.stroke();
    chartCtx.setLineDash([]);
  }

  // 3. Target Setpoint Line (Yellow Dashed)
  chartCtx.strokeStyle = '#f59e0b';
  chartCtx.lineWidth = 1.5;
  chartCtx.setLineDash([6, 6]);
  chartCtx.beginPath();
  const targetY = getY(targetTemp);
  chartCtx.moveTo(paddingLeft, targetY);
  chartCtx.lineTo(w - paddingRight, targetY);
  chartCtx.stroke();
  chartCtx.setLineDash([]);

  // 4. Outdoor Ambient Line (Orange)
  chartCtx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
  chartCtx.lineWidth = 1.5;
  chartCtx.beginPath();
  chartHistory.forEach((pt, i) => {
    const x = getX(i);
    const y = getY(pt.ambientTemp);
    if (i === 0) chartCtx.moveTo(x, y);
    else chartCtx.lineTo(x, y);
  });
  chartCtx.stroke();

  // 5. Room Temperature Line (Cyan Solid)
  chartCtx.strokeStyle = '#38bdf8';
  chartCtx.lineWidth = 2.5;
  chartCtx.beginPath();
  chartHistory.forEach((pt, i) => {
    const x = getX(i);
    const y = getY(pt.roomTemp);
    if (i === 0) chartCtx.moveTo(x, y);
    else chartCtx.lineTo(x, y);
  });
  chartCtx.stroke();

  // 6. HVAC Active State Bars at bottom
  chartHistory.forEach((pt, i) => {
    if (pt.hvacState !== 'OFF') {
      const x = getX(i);
      chartCtx.fillStyle = pt.hvacState === 'COOLING' ? 'rgba(56, 189, 248, 0.3)' : 'rgba(245, 158, 11, 0.3)';
      chartCtx.fillRect(x - 2, h - paddingBottom, 4, 8);
    }
  });

  // Legend
  chartCtx.fillStyle = '#38bdf8'; chartCtx.fillRect(w - 180, 10, 10, 10);
  chartCtx.fillStyle = '#94a3b8'; chartCtx.fillText('Room Temp', w - 165, 18);

  chartCtx.fillStyle = '#f59e0b'; chartCtx.fillRect(w - 90, 10, 10, 10);
  chartCtx.fillText('Target Setpoint', w - 75, 18);
}

// Launch on page load
window.addEventListener('DOMContentLoaded', init);
