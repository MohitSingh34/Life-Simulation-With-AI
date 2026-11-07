// ============================================================
// LIFE IN JABALPUR — MODERN LIVING CLIENT SCRIPT
// Glassmorphic 30% Cards, Interactive Top-Down House Map,
// Live Weather & Atmospheric Canvas, Equal Body System Maintenance
// ============================================================

let gameState = null;
let currentCategory = 'all';
let activeConversation = null;
let sendingMessage = false;
let selectedCharacterDetails = null;
let activeBackdropLayer = 0;
let currentBackdropRoom = null;
let backdropChangeId = 0;
const activeGameActivities = new Map();
let nextGameActivityId = 0;
let gameActivityRevealTimer = null;
let currentWeatherType = 'clear'; // clear, cloudy, rainy, stormy, foggy
let liveWeatherInfo = null;

const ROOM_SCENES = {
  bedroom: 'assets/rooms/bedroom.jpg',
  study_room: 'assets/rooms/study-room.jpg',
  kitchen: 'assets/rooms/kitchen.jpg',
  toilet: 'assets/rooms/bathroom.jpg',
  living_room: 'assets/rooms/living_room.jpg',
  balcony: 'assets/rooms/balcony.jpg',
};

// Top-Down Map Position Coordinates (SVG X, Y)
const MAP_COORDINATES = {
  bedroom: {
    bed_center: { x: 88, y: 105 },
    bedside: { x: 165, y: 120 },
    wardrobe_area: { x: 250, y: 110 },
    bedroom_door_area: { x: 260, y: 160 },
    default: { x: 120, y: 110 },
  },
  study_room: {
    desk_chair: { x: 520, y: 125 },
    bookshelf_area: { x: 385, y: 100 },
    study_door_area: { x: 350, y: 160 },
    default: { x: 480, y: 120 },
  },
  kitchen: {
    stove_area: { x: 75, y: 285 },
    counter_area: { x: 115, y: 290 },
    dining_chair: { x: 190, y: 300 },
    fridge_area: { x: 250, y: 280 },
    kitchen_door_area: { x: 260, y: 235 },
    default: { x: 150, y: 300 },
  },
  toilet: {
    shower_area: { x: 540, y: 315 },
    toilet_area: { x: 355, y: 265 },
    washbasin_area: { x: 435, y: 265 },
    toilet_door_area: { x: 350, y: 235 },
    default: { x: 450, y: 290 },
  },
  living_room: {
    sofa_area: { x: 170, y: 450 },
    coffee_table_area: { x: 170, y: 505 },
    tv_cabinet_area: { x: 75, y: 470 },
    entrance_door_area: { x: 280, y: 415 },
    default: { x: 170, y: 470 },
  },
  balcony: {
    balcony_railing: { x: 490, y: 510 },
    planters_area: { x: 480, y: 535 },
    balcony_door_area: { x: 405, y: 450 },
    cane_chair: { x: 540, y: 460 },
    default: { x: 480, y: 480 },
  },
};

// --- DOM Elements ---
const timeClock = document.getElementById('time-clock');
const timeDay = document.getElementById('time-day');
const timeWeather = document.getElementById('time-weather');
const timeIcon = document.getElementById('time-icon');
const timeWeatherPill = document.getElementById('time-weather-pill');
const weatherSkyScene = document.getElementById('weather-sky-scene');
const jabalpurClockFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const jabalpurWeekdayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Kolkata',
  weekday: 'long',
});

const playerName = document.getElementById('player-name');
const playerPoseSummary = document.getElementById('player-pose-summary');
const playerDetailedBody = document.getElementById('player-detailed-body');
const playerPresenceStatus = document.getElementById('player-presence-status');
const playerClothing = document.getElementById('player-clothing');
const playerAppearance = document.getElementById('player-appearance');
const holdingPack = document.getElementById('holding-pack');
const heldItemLabel = document.getElementById('held-item-label');
const btnPutDownItem = document.getElementById('btn-put-down-item');

// Player Needs
const barHunger = document.getElementById('bar-hunger');
const pctHunger = document.getElementById('pct-hunger');
const barThirst = document.getElementById('bar-thirst');
const pctThirst = document.getElementById('pct-thirst');
const barEnergy = document.getElementById('bar-energy');
const pctEnergy = document.getElementById('pct-energy');
const barSleepiness = document.getElementById('bar-sleepiness');
const pctSleepiness = document.getElementById('pct-sleepiness');
const barBladder = document.getElementById('bar-bladder');
const pctBladder = document.getElementById('pct-bladder');
const barHygiene = document.getElementById('bar-hygiene');
const pctHygiene = document.getElementById('pct-hygiene');

// Aria Needs (Equal Maintenance)
const ariaBarHunger = document.getElementById('aria-bar-hunger');
const ariaPctHunger = document.getElementById('aria-pct-hunger');
const ariaBarThirst = document.getElementById('aria-bar-thirst');
const ariaPctThirst = document.getElementById('aria-pct-thirst');
const ariaBarEnergy = document.getElementById('aria-bar-energy');
const ariaPctEnergy = document.getElementById('aria-pct-energy');
const ariaBarSleepiness = document.getElementById('aria-bar-sleepiness');
const ariaPctSleepiness = document.getElementById('aria-pct-sleepiness');
const ariaBarBladder = document.getElementById('aria-bar-bladder');
const ariaPctBladder = document.getElementById('aria-pct-bladder');
const ariaBarHygiene = document.getElementById('aria-bar-hygiene');
const ariaPctHygiene = document.getElementById('aria-pct-hygiene');
const ariaBodyStatusPill = document.getElementById('aria-body-status-pill');

// Aria Same-Room Visibility & Quick Actions
const ariaRoomBadge = document.getElementById('aria-room-badge');
const ariaOutOfSight = document.getElementById('aria-out-of-sight');
const ariaOutOfSightText = document.getElementById('aria-out-of-sight-text');
const ariaNeedsBox = document.getElementById('aria-needs-box');
const ariaBodyDescription = document.getElementById('aria-body-description');
const ariaClothing = document.getElementById('aria-clothing');
const ariaAppearance = document.getElementById('aria-appearance');
const ariaDetailsToggle = document.getElementById('aria-details-toggle');
const playerDetailsToggle = document.getElementById('player-details-toggle');
const playerDetailsPanel = document.getElementById('player-details-panel');
const playerAvatarStatus = document.getElementById('player-avatar-status');
const playerBodyStatusPill = document.getElementById('player-body-status-pill');
const playerDetailsDescription = document.getElementById('player-details-description');
const playerDetailsClothing = document.getElementById('player-details-clothing');
const playerDetailsAppearance = document.getElementById('player-details-appearance');
const playerQuickActionsRow = document.getElementById('player-quick-actions-row');
const playerQuickActionsCount = document.getElementById('player-quick-actions-count');
const aiAvailableActionsList = document.getElementById('ai-available-actions-list');
const btnAiAct = document.getElementById('btn-ai-act');
const aiStatusSubtext = document.getElementById('ai-status-subtext');
const btnResetStory = document.getElementById('btn-reset-story');

// Map Elements
const tokenPlayer = document.getElementById('token-player');
const tokenAi = document.getElementById('token-ai');

// Current Room
const roomHeroImage = document.getElementById('room-hero-image');
const currentRoomName = document.getElementById('current-room-name');
const roomDescription = document.getElementById('room-description');
const roomAmbience = document.getElementById('room-ambience');
const roomAmbienceTag = document.getElementById('room-ambience-tag');
const roomObjectsList = document.getElementById('room-objects-list');

// Aria Messenger
const aiLocationBadge = document.getElementById('ai-location-badge');
const aiActivityText = document.getElementById('ai-activity-text');
const chatMessagesContainer = document.getElementById('chat-messages-container');
const ariaTyping = document.getElementById('aria-typing');
const ariaChatCard = document.querySelector('.aria-chat-card');
const ariaMessageInput = document.getElementById('aria-message-input');
const btnTalkAria = document.getElementById('btn-talk-aria');

const actionsGrid = document.getElementById('actions-grid');
const alertsContainer = document.getElementById('alerts-container');

// Modals
const objInteractModal = document.getElementById('obj-interact-modal');
const objModalIcon = document.getElementById('obj-modal-icon');
const objModalName = document.getElementById('obj-modal-name');
const objModalDesc = document.getElementById('obj-modal-desc');
const objModalActions = document.getElementById('obj-modal-actions');
const btnCloseObjModal = document.getElementById('btn-close-obj-modal');

const convModal = document.getElementById('conv-modal');
const btnConvToggle = document.getElementById('btn-conv-toggle');
const btnOpenConvDrawer = document.getElementById('btn-open-conv-drawer');
const btnCloseConv = document.getElementById('btn-close-conv');
const btnNewConv = document.getElementById('btn-new-conv');
const convSessionsList = document.getElementById('conv-sessions-list');

const jsonModal = document.getElementById('json-modal');
const jsonCodeView = document.getElementById('json-code-view');
const btnJsonInspect = document.getElementById('btn-json-inspect');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnModalDismiss = document.getElementById('btn-modal-dismiss');
const btnCopyJson = document.getElementById('btn-copy-json');
const toastEl = document.getElementById('toast');
const gameProcessingIndicator = document.getElementById('game-processing-indicator');
const gameProcessingLabel = document.getElementById('game-processing-label');

// ============================================================
// 1. FREE LIVE WEATHER API (Open-Meteo for Jabalpur, MP, India)
// ============================================================

async function fetchRealWeather() {
  try {
    // Jabalpur coordinates: 23.1815° N, 79.9864° E
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=23.1815&longitude=79.9864&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&timezone=Asia%2FKolkata';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather API error');
    const data = await res.json();
    const curr = data.current;

    liveWeatherInfo = {
      temp: Math.round(curr.temperature_2m),
      code: curr.weather_code,
      humidity: curr.relative_humidity_2m,
      wind: Math.round(curr.wind_speed_10m),
      isDay: curr.is_day,
    };

    updateWeatherDisplay();
  } catch (err) {
    console.warn('Real weather fetch skipped or offline, using fallback:', err);
    liveWeatherInfo = { temp: 27, code: 1, humidity: 50, wind: 7, isDay: 1 };
    updateWeatherDisplay();
  }
}

function updateWeatherDisplay() {
  if (!liveWeatherInfo) return;

  const { temp, code, wind } = liveWeatherInfo;
  const { condition, type } = mapWmoWeather(code);
  currentWeatherType = type;

  // Apply weather class to body
  document.body.classList.remove('weather-clear', 'weather-cloudy', 'weather-rainy', 'weather-stormy', 'weather-foggy');
  document.body.classList.add(`weather-${type}`);
  document.body.dataset.weather = type;

  if (timeWeather) {
    timeWeather.textContent = `${temp}°C · Jabalpur: ${condition} · ${wind} km/h`;
    timeWeatherPill.title = `Current weather: ${timeWeather.textContent}. Click to refresh.`;
    weatherSkyScene.setAttribute('aria-label', `${condition} in Jabalpur`);
  }
}

function mapWmoWeather(code) {
  if (code === 0) return { condition: 'Clear Sky', type: 'clear' };
  if (code <= 3) return { condition: 'Partly Cloudy', type: 'cloudy' };
  if (code === 45 || code === 48) return { condition: 'Morning Fog', type: 'foggy' };
  if (code >= 51 && code <= 67) return { condition: 'Light Rain', type: 'rainy' };
  if (code >= 80 && code <= 82) return { condition: 'Rain Showers', type: 'rainy' };
  if (code >= 95) return { condition: 'Thunderstorm', type: 'stormy' };
  return { condition: 'Mild Breeze', type: 'clear' };
}

// ============================================================
// 2. DYNAMIC ATMOSPHERIC CANVAS (Rain, Dust Motes, Stars, Fog)
// ============================================================

const weatherCanvas = document.getElementById('weather-canvas');
const ctx = weatherCanvas ? weatherCanvas.getContext('2d') : null;
let particles = [];
let canvasAnimId = null;

function initWeatherCanvas() {
  if (!weatherCanvas || !ctx) return;

  function resizeCanvas() {
    weatherCanvas.width = window.innerWidth;
    weatherCanvas.height = window.innerHeight;
    createParticles();
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  renderAtmosphericParticles();
}

function createParticles() {
  particles = [];
  const count = currentWeatherType === 'rainy' || currentWeatherType === 'stormy' ? 120 : 45;

  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * weatherCanvas.width,
      y: Math.random() * weatherCanvas.height,
      len: Math.random() * 18 + 12,
      speedY: Math.random() * 8 + 6,
      speedX: (Math.random() - 0.5) * 1.5,
      radius: Math.random() * 2 + 1,
      alpha: Math.random() * 0.6 + 0.2,
      pulse: Math.random() * Math.PI * 2,
    });
  }
}

function renderAtmosphericParticles() {
  if (!ctx) return;
  ctx.clearRect(0, 0, weatherCanvas.width, weatherCanvas.height);

  const timeOfDay = gameState?.time?.timeOfDay || 'morning';

  if (currentWeatherType === 'rainy' || currentWeatherType === 'stormy') {
    // Render Falling Rain Streaks
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.45)';
    ctx.lineWidth = 1.2;
    for (const p of particles) {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.speedX * 2, p.y + p.len);
      ctx.stroke();

      p.y += p.speedY;
      p.x += p.speedX;

      if (p.y > weatherCanvas.height) {
        p.y = -p.len;
        p.x = Math.random() * weatherCanvas.width;
      }
    }
  } else if (timeOfDay === 'night') {
    // Twinkling Starlight Particles
    for (const p of particles) {
      p.pulse += 0.02;
      const currentAlpha = 0.3 + 0.5 * Math.sin(p.pulse);
      ctx.fillStyle = `rgba(224, 231, 255, ${Math.max(0.1, currentAlpha)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();

      p.y -= 0.15;
      if (p.y < 0) p.y = weatherCanvas.height;
    }
  } else {
    // Golden Warm Morning/Afternoon Floating Dust Motes
    const color = timeOfDay === 'evening' ? 'rgba(244, 63, 94, 0.35)' : 'rgba(253, 224, 71, 0.32)';
    for (const p of particles) {
      p.pulse += 0.015;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * (0.8 + 0.3 * Math.sin(p.pulse)), 0, Math.PI * 2);
      ctx.fill();

      p.y -= 0.25;
      p.x += Math.sin(p.pulse) * 0.3;

      if (p.y < 0) {
        p.y = weatherCanvas.height;
        p.x = Math.random() * weatherCanvas.width;
      }
    }
  }

  canvasAnimId = requestAnimationFrame(renderAtmosphericParticles);
}

// ============================================================
// 3. API METHODS & STATE MANAGEMENT
// ============================================================

let lastRenderedStateSignature = '';
let statePollInProgress = false;

function startGameActivity(label) {
  const activityId = ++nextGameActivityId;
  activeGameActivities.set(activityId, label);
  if (gameProcessingLabel) gameProcessingLabel.textContent = label;
  if (gameActivityRevealTimer) clearTimeout(gameActivityRevealTimer);
  gameActivityRevealTimer = setTimeout(() => {
    if (!activeGameActivities.size || !gameProcessingIndicator) return;
    gameProcessingIndicator.hidden = false;
    gameProcessingIndicator.setAttribute('aria-hidden', 'false');
    document.body.setAttribute('aria-busy', 'true');
  }, 140);

  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    activeGameActivities.delete(activityId);
    if (activeGameActivities.size) {
      const currentLabel = [...activeGameActivities.values()].at(-1);
      if (gameProcessingLabel && currentLabel) gameProcessingLabel.textContent = currentLabel;
      return;
    }

    if (gameActivityRevealTimer) {
      clearTimeout(gameActivityRevealTimer);
      gameActivityRevealTimer = null;
    }
    if (gameProcessingIndicator) {
      gameProcessingIndicator.hidden = true;
      gameProcessingIndicator.setAttribute('aria-hidden', 'true');
    }
    document.body.removeAttribute('aria-busy');
  };
}

function getStateSignature(state) {
  return JSON.stringify({
    player: state.player,
    ai: state.ai,
    roomDetails: state.roomDetails,
    time: state.time,
    alerts: state.alerts,
    availableActions: state.availableActions,
    aiAvailableActions: state.aiAvailableActions,
    objectStates: state.world?.objects?.map(({ id, currentState, roomId, positionId, heldBy, occupiedBy }) => ({
      id, currentState, roomId, positionId, heldBy, occupiedBy,
    })),
    houseLayout: state.houseLayout,
    narrative: state.narrative,
    events: state.events,
    conversationMessageIds: state.activeConversation?.messages?.map((message) => message.id),
  });
}

async function fetchState() {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) throw new Error('Failed to fetch state');
    gameState = await res.json();
    lastRenderedStateSignature = getStateSignature(gameState);
    if (gameState.activeConversation) {
      activeConversation = gameState.activeConversation;
    }
    renderAll();
  } catch (err) {
    console.error('Fetch state error:', err);
    showToast('⚠️ Could not connect to game server');
  }
}

async function pollGameState() {
  if (statePollInProgress || document.hidden || sendingMessage) return;
  statePollInProgress = true;
  try {
    const res = await fetch('/api/state');
    if (!res.ok) throw new Error(`Failed to poll game state (HTTP ${res.status})`);
    const nextState = await res.json();
    const signature = getStateSignature(nextState);
    gameState = nextState;
    if (nextState.activeConversation) {
      activeConversation = nextState.activeConversation;
    }
    if (signature !== lastRenderedStateSignature) {
      lastRenderedStateSignature = signature;
      renderAll();
    }
  } catch (err) {
    console.warn('Game state polling failed:', err);
  } finally {
    statePollInProgress = false;
  }
}

async function submitAction(actionId, targetObjectId) {
  const actionName = gameState?.availableActions?.find((action) => action.id === actionId)?.name;
  const activityLabel = actionId.startsWith('walk_to_')
    ? `Walking to ${capitalize(actionId.slice('walk_to_'.length).replace(/_/g, ' '))}…`
    : `${actionName || 'Updating the simulation'}…`;
  const finishActivity = startGameActivity(activityLabel);
  try {
    const res = await fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionId, targetObjectId }),
    });
    const data = await res.json();

    if (data.message) {
      showToast(data.message);
    }

    if (data.edits) {
      applyAiEdits(data.edits, true);
    }

    await fetchState();
    if (data.success) {
      window.dispatchEvent(new CustomEvent('houseStateUpdated', {
        detail: {
          feedback: {
            actor: 'player',
            floatText: {
              actor: 'player',
              text: actionName || 'Action complete',
              color: '#a7f3d0'
            }
          }
        }
      }));
    }
    return data.success === true;
  } catch (err) {
    console.error('Action error:', err);
    showToast('Action could not be performed');
    return false;
  } finally {
    finishActivity();
  }
}

async function talkToAria() {
  if (sendingMessage) return;
  const message = ariaMessageInput.value.trim();
  if (!message) {
    ariaMessageInput.focus();
    showToast('Write a message for Aria first');
    return;
  }

  const finishActivity = startGameActivity('Waiting for Aria…');
  const nowClock = gameState ? format12Hour(gameState.time.clock) : 'Just now';
  const sentBubble = appendChatMessage('player', message, nowClock, true, true);
  ariaMessageInput.value = '';
  sendingMessage = true;
  btnTalkAria.disabled = true;
  ariaChatCard.classList.add('is-thinking');
  ariaTyping.hidden = false;
  ariaTyping.classList.add('is-visible');
  chatMessagesContainer.appendChild(ariaTyping);
  scrollChatToBottom();

  try {
    const res = await fetch('/api/talk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gemini could not reply');

    await fetchState();

    if (data.activeConversation) {
      activeConversation = data.activeConversation;
      renderChatStream(activeConversation.messages, true);
    } else if (data.dialogue) {
      appendChatMessage('aria', data.dialogue, nowClock, true, true);
    }

    if (data.dialogue && window.phaserHouseGame?.scene?.keys?.HouseScene) {
      window.phaserHouseGame.scene.keys.HouseScene.showCharacterSpeech('ai', data.dialogue);
    }

    if (data.layout) {
      window.dispatchEvent(new CustomEvent('houseStateUpdated', {
        detail: { layout: data.layout }
      }));
    }

    if (data.edits) {
      applyAiEdits(data.edits, true);
    }

    showToast('💬 Aria replied');
  } catch (err) {
    sentBubble.classList.add('message-failed');
    showToast(err.message || 'Could not talk to Aria right now');
  } finally {
    finishActivity();
    sendingMessage = false;
    ariaTyping.hidden = true;
    ariaTyping.classList.remove('is-visible');
    if (ariaTyping.parentNode) {
      ariaTyping.remove();
    }
    ariaChatCard.classList.remove('is-thinking');
    const isTogether = gameState && gameState.ai.location.roomId === gameState.player.location.roomId;
    btnTalkAria.disabled = !isTogether;
  }
}

// ============================================================
// 4. RENDER ALL (UI, MAP AVATARS, EQUAL NEEDS)
// ============================================================

function renderAll() {
  if (!gameState) return;

  const { player, ai, inSameRoom, roomDetails, time, alerts, availableActions, aiAvailableActions, narrative } = gameState;
  const narr = narrative || {};
  const isTogether = inSameRoom !== undefined ? inSameRoom : (player.location.roomId === ai.location.roomId);

  // Background room scene & theme
  transitionRoomScene(player.location.roomId);
  applyTimeTheme(time.timeOfDay);

  // 1. Time Capsule Pill
  timeClock.textContent = format12Hour(time.clock);
  timeDay.textContent = `${getDayName(time.dayOfWeek)}, Day ${time.day}`;
  if (timeIcon) timeIcon.textContent = getAmbienceEmoji(time.timeOfDay);
  updateLiveClock();

  // 2. Player Profile & Pose
  playerName.textContent = (player.name || 'Mohit').toUpperCase();
  const derivedPlayerPose = gameState?.playerBodyState?.player?.pose || getNaturalPoseSummary(player);
  const derivedPlayerBody = gameState?.playerBodyState?.player?.body || getDetailedPhysicalDescription(player);
  playerPoseSummary.textContent = narr.player_pose || derivedPlayerPose;
  playerDetailedBody.textContent = narr.player_body || derivedPlayerBody;
  playerPresenceStatus.textContent = `Present · In ${roomDetails.room.name}`;
  playerClothing.textContent = narr.player_clothing || `${player.clothing.upper}, ${player.clothing.lower} (${player.clothing.footwear})`;
  playerAppearance.textContent = formatAppearance(player.appearance);
  renderHeldItem(player);

  // 3. Player Body Needs
  renderPlayerNeeds(player.needs);

  // 4. Aria Body Needs (Equal Maintenance, visible only when in same room)
  renderAriaNeeds(ai, isTogether, roomDetails?.room?.name);
  renderCharacterDetails(player);

  // 5. Top-Down House Map with Animated Avatars
  renderHouseMap(player, ai);
  syncPhaserHouse(player, ai, gameState.houseLayout);

  // 6. Current Room Detail Card (Hero image in background, tags on top)
  renderCurrentRoomScene(roomDetails, time, narr);

  // 7. Aria Roommate Chat Stream
  renderAria(ai, player, narr, isTogether);

  // 8. Player Quick Actions Row (Above Chat Message Box)
  renderPlayerQuickActions(availableActions);

  // 9. Full Actions Grid Deck
  renderActions(availableActions);

  // 10. Aria's Available Actions List
  renderAiAvailableActions(aiAvailableActions || []);

  // 11. Alerts
  renderAlerts(alerts);
}

function applyTimeTheme(timeOfDay) {
  document.body.classList.remove('theme-morning', 'theme-afternoon', 'theme-evening', 'theme-night');
  const period = timeOfDay || 'morning';
  document.body.classList.add(`theme-${period}`);
  document.body.dataset.time = period;
  if (weatherSkyScene) {
    const timeLabel = period === 'night' ? 'Night sky' : `${capitalize(period)} sky`;
    const condition = liveWeatherInfo ? mapWmoWeather(liveWeatherInfo.code).condition : 'moving clouds';
    weatherSkyScene.setAttribute('aria-label', `${timeLabel}, ${condition}`);
  }
}

function updateLiveClock() {
  const now = new Date();
  const [hours, minutes] = jabalpurClockFormatter.format(now).split(':').map(Number);
  const period = hours >= 5 && hours < 12
    ? 'morning'
    : hours < 17
      ? 'afternoon'
      : hours < 22
        ? 'evening'
        : 'night';

  timeClock.textContent = format12Hour(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
  timeDay.textContent = `${jabalpurWeekdayFormatter.format(now)}, Day ${gameState?.time?.day ?? 1}`;
  if (timeIcon) timeIcon.textContent = getAmbienceEmoji(period);
  if (document.body.dataset.time !== period) {
    applyTimeTheme(period);
  }
  if (gameState?.time) {
    gameState.time.timeOfDay = period;
  }
}

async function refreshLiveVitals() {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) throw new Error('Failed to refresh live needs');
    gameState = await res.json();
    const isTogether = gameState.inSameRoom !== undefined ? gameState.inSameRoom : (gameState.player.location.roomId === gameState.ai.location.roomId);
    renderPlayerNeeds(gameState.player.needs);
    renderAriaNeeds(gameState.ai.needs, isTogether, gameState.roomDetails?.room?.name);
    renderAlerts(gameState.alerts);
    updateLiveClock();
  } catch (err) {
    console.error('Live needs refresh error:', err);
  }
}

function renderPlayerNeeds(needs) {
  if (!needs) return;
  const hunger = Math.round(needs.hunger);
  barHunger.style.width = `${hunger}%`;
  pctHunger.textContent = `${hunger}%`;

  const thirst = Math.round(needs.thirst);
  barThirst.style.width = `${thirst}%`;
  pctThirst.textContent = `${thirst}%`;

  const energy = Math.round(needs.energy);
  barEnergy.style.width = `${energy}%`;
  pctEnergy.textContent = `${energy}%`;

  const sleep = Math.round(needs.sleepiness);
  barSleepiness.style.width = `${sleep}%`;
  pctSleepiness.textContent = `${sleep}%`;

  if (barBladder && pctBladder && needs.bladder !== undefined) {
    const bladder = Math.round(needs.bladder);
    barBladder.style.width = `${bladder}%`;
    pctBladder.textContent = `${bladder}%`;
  }

  if (barHygiene && pctHygiene && needs.hygiene !== undefined) {
    const hygiene = Math.round(needs.hygiene);
    barHygiene.style.width = `${hygiene}%`;
    pctHygiene.textContent = `${hygiene}%`;
  }
}

function renderAriaNeeds(ai, inSameRoom = true, currentRoomName = '') {
  const aiNeeds = ai?.needs;
  if (!aiNeeds) return;

  const aiRoomName = capitalize((gameState?.ai?.location?.roomId || 'other room').replace('_', ' '));

  if (!inSameRoom) {
    if (ariaNeedsBox) ariaNeedsBox.hidden = true;
    if (ariaOutOfSight) {
      ariaOutOfSight.hidden = selectedCharacterDetails !== 'aria';
      if (ariaOutOfSightText) {
        ariaOutOfSightText.textContent = `Aria is in ${aiRoomName} — physical state and needs are out of sight`;
      }
    }
    return;
  }

  // Same room: display physical state and vitals
  if (ariaOutOfSight) ariaOutOfSight.hidden = true;
  if (ariaNeedsBox) ariaNeedsBox.hidden = selectedCharacterDetails !== 'aria';
  if (ariaBodyDescription) ariaBodyDescription.textContent = getDetailedPhysicalDescription(ai);
  if (ariaClothing) {
    ariaClothing.textContent = `${ai.clothing.upper}, ${ai.clothing.lower} (${ai.clothing.footwear})`;
  }
  if (ariaAppearance) ariaAppearance.textContent = formatAppearance(ai.appearance);

  const hunger = Math.round(aiNeeds.hunger);
  if (ariaBarHunger) ariaBarHunger.style.width = `${hunger}%`;
  if (ariaPctHunger) ariaPctHunger.textContent = `${hunger}%`;

  const thirst = Math.round(aiNeeds.thirst);
  if (ariaBarThirst) ariaBarThirst.style.width = `${thirst}%`;
  if (ariaPctThirst) ariaPctThirst.textContent = `${thirst}%`;

  const energy = Math.round(aiNeeds.energy);
  if (ariaBarEnergy) ariaBarEnergy.style.width = `${energy}%`;
  if (ariaPctEnergy) ariaPctEnergy.textContent = `${energy}%`;

  const sleep = Math.round(aiNeeds.sleepiness);
  if (ariaBarSleepiness) ariaBarSleepiness.style.width = `${sleep}%`;
  if (ariaPctSleepiness) ariaPctSleepiness.textContent = `${sleep}%`;

  if (ariaBarBladder && ariaPctBladder && aiNeeds.bladder !== undefined) {
    const bladder = Math.round(aiNeeds.bladder);
    ariaBarBladder.style.width = `${bladder}%`;
    ariaPctBladder.textContent = `${bladder}%`;
  }

  if (ariaBarHygiene && ariaPctHygiene && aiNeeds.hygiene !== undefined) {
    const hygiene = Math.round(aiNeeds.hygiene);
    ariaBarHygiene.style.width = `${hygiene}%`;
    ariaPctHygiene.textContent = `${hygiene}%`;
  }

  // Status Summary
  if (ariaBodyStatusPill) {
    if (aiNeeds.bladder !== undefined && aiNeeds.bladder >= 75) {
      ariaBodyStatusPill.textContent = 'Urgent: Needs Washroom';
      ariaBodyStatusPill.style.color = '#38bdf8';
    } else if (hunger >= 75) {
      ariaBodyStatusPill.textContent = 'Hungry & Needing Food';
      ariaBodyStatusPill.style.color = '#fbbf24';
    } else if (thirst >= 75) {
      ariaBodyStatusPill.textContent = 'Thirsty & Needs Water';
      ariaBodyStatusPill.style.color = '#38bdf8';
    } else if (energy <= 25) {
      ariaBodyStatusPill.textContent = 'Fatigued & Low Energy';
      ariaBodyStatusPill.style.color = '#f87171';
    } else if (sleep >= 75) {
      ariaBodyStatusPill.textContent = 'Sleepy & Ready for Rest';
      ariaBodyStatusPill.style.color = '#c084fc';
    } else if (aiNeeds.hygiene !== undefined && aiNeeds.hygiene <= 30) {
      ariaBodyStatusPill.textContent = 'Wants to Freshen Up';
      ariaBodyStatusPill.style.color = '#2dd4bf';
    } else {
      ariaBodyStatusPill.textContent = 'Satisfied & Well';
      ariaBodyStatusPill.style.color = '#34d399';
    }
  }
}

function renderCharacterDetails(player) {
  const playerRoom = gameState.world?.allRooms?.find((room) => room.id === player.location.roomId);
  const playerRoomName = playerRoom?.name || capitalize(player.location.roomId.replace(/_/g, ' '));

  if (ariaDetailsToggle) {
    ariaDetailsToggle.setAttribute('aria-expanded', selectedCharacterDetails === 'aria' ? 'true' : 'false');
  }
  if (playerDetailsToggle) {
    playerDetailsToggle.setAttribute('aria-expanded', selectedCharacterDetails === 'player' ? 'true' : 'false');
  }
  if (playerAvatarStatus) {
    playerAvatarStatus.textContent = `YOU · ${playerRoomName.toUpperCase()}`;
  }

  if (playerDetailsPanel) {
    playerDetailsPanel.hidden = selectedCharacterDetails !== 'player';
  }
  if (playerDetailsDescription) {
    playerDetailsDescription.textContent =
      gameState.playerBodyState?.body || getDetailedPhysicalDescription(player);
  }
  if (playerBodyStatusPill) {
    playerBodyStatusPill.textContent = `In ${playerRoomName}`;
  }
  if (playerDetailsClothing) {
    playerDetailsClothing.textContent =
      `${player.clothing.upper}, ${player.clothing.lower} (${player.clothing.footwear})`;
  }
  if (playerDetailsAppearance) {
    playerDetailsAppearance.textContent = formatAppearance(player.appearance);
  }

  for (const element of playerDetailsPanel?.querySelectorAll('[data-player-need]') || []) {
    const needName = element.dataset.playerNeed;
    const value = player.needs[needName];
    element.textContent = Number.isFinite(value) ? `${Math.round(value)}%` : '—';
  }
}

function toggleCharacterDetails(character) {
  selectedCharacterDetails = selectedCharacterDetails === character ? null : character;
  if (gameState) {
    renderAriaNeeds(
      gameState.ai,
      gameState.ai.location.roomId === gameState.player.location.roomId,
      gameState.roomDetails?.room?.name
    );
    renderCharacterDetails(gameState.player);
  }
}

function formatAppearance(appearance = {}) {
  const labels = {
    face_hair: 'Facial hair',
    torso_outer: 'Outer layer',
    torso_inner: 'Inner layer',
    upper_arm_left: 'Left upper arm',
    upper_arm_right: 'Right upper arm',
    elbow_left: 'Left elbow',
    elbow_right: 'Right elbow',
    forearm_left: 'Left forearm',
    forearm_right: 'Right forearm',
    wrist_left: 'Left wrist',
    wrist_right: 'Right wrist',
    hand_left: 'Left hand',
    hand_right: 'Right hand',
    thigh_left: 'Left thigh',
    thigh_right: 'Right thigh',
    knee_left: 'Left knee',
    knee_right: 'Right knee',
    calf_left: 'Left calf',
    calf_right: 'Right calf',
    foot_left: 'Left foot',
    foot_right: 'Right foot',
  };
  const stateDrivenSlots = new Set(['body', 'clothes', 'torso_inner', 'legs', 'feet']);
  const details = Object.entries(appearance)
    .filter(([slot, value]) => !stateDrivenSlots.has(slot) && value && value.toLowerCase() !== 'nothing')
    .map(([slot, value]) => `${labels[slot] || capitalize(slot.replace(/_/g, ' '))}: ${value}`);

  return details.length ? details.join(' · ') : 'No additional appearance details';
}

// ============================================================
// 5. TOP-DOWN HOUSE MAP RENDERING & AVATAR ANIMATION
// ============================================================

function renderHouseMap(player, ai) {
  // 1. Highlight Active Room Zone
  const rooms = ['bedroom', 'study_room', 'kitchen', 'toilet', 'living_room', 'balcony'];
  for (const r of rooms) {
    const zone = document.getElementById(`map-room-${r}`);
    if (zone) {
      zone.classList.toggle('active-map-room', player.location.roomId === r);
    }
  }

  // 2. Position Mohit's Avatar Token
  const pCoords = getCoordinates(player.location.roomId, player.location.positionId);
  if (tokenPlayer && pCoords) {
    tokenPlayer.setAttribute('transform', `translate(${pCoords.x}, ${pCoords.y})`);
  }

  // 3. Position Aria's Avatar Token
  let aiCoords = getCoordinates(ai.location.roomId, ai.location.positionId);
  // Avoid exact overlap if in same position
  if (pCoords && aiCoords && pCoords.x === aiCoords.x && pCoords.y === aiCoords.y) {
    aiCoords = { x: aiCoords.x + 28, y: aiCoords.y };
  }
  if (tokenAi && aiCoords) {
    tokenAi.setAttribute('transform', `translate(${aiCoords.x}, ${aiCoords.y})`);
  }
}

function getCoordinates(roomId, posId) {
  const roomMap = MAP_COORDINATES[roomId] || MAP_COORDINATES.bedroom;
  return roomMap[posId] || roomMap.default;
}

// ============================================================
// 5B. MAP HOVERCARD / INFO CARD CONTROLLER (MODERN WEB GUIDANCE)
// ============================================================

const mapHovercard = document.getElementById('map-hovercard');
const hcIcon = document.getElementById('hc-icon');
const hcTitle = document.getElementById('hc-title');
const hcCategory = document.getElementById('hc-category');
const hcStatus = document.getElementById('hc-status');
const hcDesc = document.getElementById('hc-desc');
const hcLocationRow = document.getElementById('hc-location-row');
const hcLocation = document.getElementById('hc-location');
const hcPresenceRow = document.getElementById('hc-presence-row');
const hcPresence = document.getElementById('hc-presence');
const hcActionsRow = document.getElementById('hc-actions-row');
const hcActions = document.getElementById('hc-actions');
const hcDetailsRow = document.getElementById('hc-details-row');
const hcDetails = document.getElementById('hc-details');
const hcHint = document.getElementById('hc-hint');
const mapCanvasFrame = document.querySelector('.map-canvas-frame');
const houseMapSvg = document.getElementById('house-map-svg');

let currentHoverTarget = null;

function getStatusBadgeClass(status) {
  if (!status) return '';
  const s = String(status).toLowerCase();
  if (['neat', 'clean', 'clear', 'blooming', 'watered', 'vacant', 'ready', 'open passage', 'available'].includes(s)) {
    return 'status-green';
  }
  if (['cooking', 'steaming', 'half', 'needs_flush', 'with_food', 'has_items', 'full', 'foggy', 'open'].includes(s)) {
    return 'status-amber';
  }
  if (['occupied', 'occupied_lying', 'occupied_sitting', 'in_use', 'closed', 'sitting', 'lying'].includes(s)) {
    return 'status-purple';
  }
  if (['running', 'running_tap', 'streaming', 'on', 'standing'].includes(s)) {
    return 'status-blue';
  }
  return '';
}

function formatCleanActionName(actionId) {
  if (!actionId) return '';
  const act = gameState?.availableActions?.find(a => a.id === actionId);
  if (act && act.name) return act.name;
  return actionId
    .replace(/^walk_to_/, 'Walk to ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function hideHovercard() {
  if (mapHovercard) {
    mapHovercard.classList.remove('is-visible');
    mapHovercard.setAttribute('aria-hidden', 'true');
    currentHoverTarget = null;
  }
}

function updateHovercardPosition(e, targetElem) {
  if (!mapHovercard || !mapCanvasFrame) return;
  const frameRect = mapCanvasFrame.getBoundingClientRect();
  const cardWidth = mapHovercard.offsetWidth || 290;
  const cardHeight = mapHovercard.offsetHeight || 190;

  let clientX = e?.clientX;
  let clientY = e?.clientY;

  // Fallback for keyboard contextmenu (Shift+F10) or missing coordinates
  if (clientX === undefined || clientY === undefined || (clientX === 0 && clientY === 0)) {
    if (targetElem) {
      const targetRect = targetElem.getBoundingClientRect();
      clientX = targetRect.left + targetRect.width / 2;
      clientY = targetRect.top + targetRect.height / 2;
    } else {
      clientX = frameRect.left + frameRect.width / 2;
      clientY = frameRect.top + frameRect.height / 2;
    }
  }

  // Pointer position relative to frame container
  let x = clientX - frameRect.left + 14;
  let y = clientY - frameRect.top + 14;

  // Horizontal collision check: if card overflows right edge, flip to left of cursor
  if (x + cardWidth > frameRect.width - 12) {
    x = clientX - frameRect.left - cardWidth - 14;
  }
  // Vertical collision check: if card overflows bottom edge, flip above cursor
  if (y + cardHeight > frameRect.height - 12) {
    y = clientY - frameRect.top - cardHeight - 14;
  }

  // Bounds clamping to stay strictly inside map frame
  x = Math.max(10, Math.min(x, frameRect.width - cardWidth - 10));
  y = Math.max(10, Math.min(y, frameRect.height - cardHeight - 10));

  mapHovercard.style.left = `${Math.round(x)}px`;
  mapHovercard.style.top = `${Math.round(y)}px`;
}

function showHovercardForTarget(targetElem, e) {
  if (!gameState || !mapHovercard) return;

  // 1. Character Tokens
  const tokenElem = targetElem.closest('.avatar-map-token');
  if (tokenElem) {
    const isPlayer = tokenElem.id === 'token-player' || tokenElem.classList.contains('token-player');
    const char = isPlayer ? gameState.player : gameState.ai;
    if (!char) return;

    const isTogether = isPlayer ? true : (gameState.inSameRoom !== undefined ? gameState.inSameRoom : (gameState.ai.location.roomId === gameState.player.location.roomId));

    hcIcon.textContent = isPlayer ? '👤' : '✨';
    hcTitle.textContent = isPlayer ? `${char.name || 'Mohit'} (You)` : `${char.name || 'Aria'} (Roommate)`;
    hcCategory.textContent = isPlayer ? 'PROTAGONIST' : 'AI COMPANION';

    if (isPlayer) {
      hcStatus.textContent = char.body.posture;
      hcStatus.className = `hovercard-status-badge ${getStatusBadgeClass(char.body.posture)}`;

      const derivedBody = gameState.narrative?.player_body || getDetailedPhysicalDescription(char);
      hcDesc.textContent = derivedBody;

      hcLocationRow.style.display = 'flex';
      hcLocation.textContent = `${capitalize(char.location.roomId.replace('_', ' '))} (${char.location.positionId})`;

      hcPresenceRow.style.display = 'flex';
      hcPresence.textContent = `Facing ${char.body.orientation || 'front'} · Mood: ${gameState.mood || 'Calm'}`;

      hcActionsRow.style.display = 'flex';
      const attireUpper = char.clothing?.upper || 'Comfortable Kurta';
      const attireLower = char.clothing?.lower || 'Track Pants';
      hcActions.textContent = `👔 Wearing: ${attireUpper}, ${attireLower}`;

      hcDetailsRow.style.display = 'flex';
      const bladderStr = char.needs.bladder !== undefined ? ` · 🚽 Bladder: ${Math.round(char.needs.bladder)}%` : '';
      hcDetails.textContent = `⚡ Energy: ${Math.round(char.needs.energy)}% · 🍽️ Hunger: ${Math.round(char.needs.hunger)}% · 🧼 Hygiene: ${Math.round(char.needs.hygiene)}%${bladderStr}`;

      hcHint.textContent = 'Active character · Left-click objects to command';
    } else {
      // Aria
      if (isTogether) {
        hcStatus.textContent = char.body.posture;
        hcStatus.className = `hovercard-status-badge ${getStatusBadgeClass(char.body.posture)}`;
        hcDesc.textContent = gameState.aiBodyState?.description || 'Perceptive, gentle Jabalpur engineering roommate. Always studying, reflecting, or sharing warm moments.';
        hcLocationRow.style.display = 'flex';
        hcLocation.textContent = `${capitalize(char.location.roomId.replace('_', ' '))} (${char.location.positionId})`;
        hcPresenceRow.style.display = 'flex';
        hcPresence.textContent = 'Together in same room (Companionship active)';
        hcActionsRow.style.display = 'flex';
        const attireUpper = char.clothing?.upper || 'Chikan Kurti';
        const attireLower = char.clothing?.lower || 'Palazzo';
        hcActions.textContent = `👔 Wearing: ${attireUpper}, ${attireLower}`;
        hcDetailsRow.style.display = 'flex';
        const bladderStr = char.needs.bladder !== undefined ? ` · 🚽 Bladder: ${Math.round(char.needs.bladder)}%` : '';
        hcDetails.textContent = `⚡ Energy: ${Math.round(char.needs.energy)}% · 🍽️ Hunger: ${Math.round(char.needs.hunger)}% · 🧼 Hygiene: ${Math.round(char.needs.hygiene)}%${bladderStr}`;
        hcHint.textContent = 'Roommate · Left-click talk button to converse ›';
      } else {
        const roomName = capitalize(char.location.roomId.replace('_', ' '));
        hcStatus.textContent = 'Out of sight';
        hcStatus.className = 'hovercard-status-badge status-separate';
        hcDesc.textContent = `Aria is in ${roomName}. Because you are in different rooms, her physical posture, body state, and vitals are out of your line of sight.`;
        hcLocationRow.style.display = 'flex';
        hcLocation.textContent = `${roomName} (Separate Room)`;
        hcPresenceRow.style.display = 'flex';
        hcPresence.textContent = 'Separate room · Physical state hidden';
        hcActionsRow.style.display = 'flex';
        hcActions.textContent = '👔 Attire: (Out of sight)';
        hcDetailsRow.style.display = 'flex';
        hcDetails.textContent = 'Physical vitals: Hidden from view';
        hcHint.textContent = `Walk to ${roomName} to observe Aria and converse ›`;
      }
    }

    mapHovercard.classList.add('is-visible');
    mapHovercard.setAttribute('aria-hidden', 'false');
    updateHovercardPosition(e, targetElem);
    return;
  }

  // 2. Interactive Objects
  const objElem = targetElem.closest('.interactive-obj');
  if (objElem) {
    const objId = objElem.dataset.obj;
    const allObjects = gameState.world?.objects || gameState.roomDetails?.objects || [];
    const obj = allObjects.find(o => o.id === objId);

    // Fallback if not found in list
    const objName = obj?.name || formatCleanActionName(objId);
    const objType = (obj?.type || 'furniture').toUpperCase();
    const objState = obj?.currentState || 'ready';
    const objIcon = obj?.icon || (objId.includes('bed') ? '🛏️' : objId.includes('lamp') ? '💡' : objId.includes('sofa') ? '🛋️' : objId.includes('tv') ? '📺' : objId.includes('plant') ? '🪴' : objId.includes('chair') ? '🪑' : objId.includes('stove') ? '🔥' : objId.includes('book') ? '📚' : '📦');

    hcIcon.textContent = objIcon;
    hcTitle.textContent = objName;
    hcCategory.textContent = objType;
    hcStatus.textContent = objState;
    hcStatus.className = `hovercard-status-badge ${getStatusBadgeClass(objState)}`;

    hcDesc.textContent = obj?.stateDescriptions?.[objState] || obj?.description || 'Interactive household fixture.';

    hcLocationRow.style.display = 'flex';
    const roomName = capitalize((obj?.roomId || objElem.dataset.room || '').replace('_', ' '));
    const posName = obj?.positionId ? ` · ${obj.positionId}` : '';
    hcLocation.textContent = `${roomName}${posName}`;

    // Presence or holder
    if (obj?.heldBy) {
      hcPresenceRow.style.display = 'flex';
      hcPresence.textContent = `Currently carried by ${obj.heldBy === 'player_001' ? 'Mohit' : 'Aria'}`;
    } else {
      hcPresenceRow.style.display = 'none';
    }

    // Actions list
    hcActionsRow.style.display = 'flex';
    const interactions = obj?.interactions || [];
    if (interactions.length > 0) {
      const formattedActions = interactions.slice(0, 4).map(actId => {
        const isAvail = gameState.availableActions?.some(a => a.id === actId);
        const name = formatCleanActionName(actId);
        return isAvail ? `${name} ✓` : name;
      });
      hcActions.textContent = formattedActions.join(' · ') + (interactions.length > 4 ? ` (+${interactions.length - 4} more)` : '');
    } else {
      hcActions.textContent = 'None directly';
    }

    // Details row: contained items or portability
    if (obj?.containedObjectIds && obj.containedObjectIds.length > 0) {
      hcDetailsRow.style.display = 'flex';
      hcDetails.textContent = `Contains ${obj.containedObjectIds.length} items (books, notebooks & guides)`;
    } else if (obj?.portable) {
      hcDetailsRow.style.display = 'flex';
      hcDetails.textContent = 'Portable item · Can be carried into any room';
    } else {
      hcDetailsRow.style.display = 'none';
    }

    const isInSameRoom = gameState.player.location.roomId === (obj?.roomId || objElem.dataset.room);
    hcHint.textContent = isInSameRoom ? 'Left-click object to interact · Esc to close' : `Walk to ${roomName} first · Esc to close`;

    mapHovercard.classList.add('is-visible');
    mapHovercard.setAttribute('aria-hidden', 'false');
    updateHovercardPosition(e, targetElem);
    return;
  }

  // 3. Room Zone Floors
  const roomElem = targetElem.closest('.room-zone');
  if (roomElem) {
    const roomId = roomElem.dataset.room;
    const allRooms = gameState.world?.allRooms || [];
    const roomConfig = allRooms.find(r => r.id === roomId);

    const isCurrent = gameState.player.location.roomId === roomId;
    const roomName = roomConfig?.name || capitalize(roomId.replace('_', ' '));
    const roomIcon = roomId === 'bedroom' ? '🛏️' : roomId === 'study_room' ? '📚' : roomId === 'kitchen' ? '🍳' : roomId === 'toilet' ? '🚿' : roomId === 'living_room' ? '🛋️' : '🌿';

    hcIcon.textContent = roomIcon;
    hcTitle.textContent = roomName;
    hcCategory.textContent = isCurrent ? 'CURRENT LOCATION' : 'ROOM ZONE';
    hcStatus.textContent = isCurrent ? 'You are here' : 'Reachable';
    hcStatus.className = `hovercard-status-badge ${isCurrent ? 'status-green' : 'status-blue'}`;

    hcDesc.textContent = roomConfig?.description || 'A comfortable space inside the Jabalpur home.';

    hcLocationRow.style.display = 'flex';
    hcLocation.textContent = 'Ground Floor · Jabalpur Residence';

    hcPresenceRow.style.display = 'flex';
    const hasPlayer = gameState.player.location.roomId === roomId;
    const hasAi = gameState.ai.location.roomId === roomId;
    if (hasPlayer && hasAi) {
      hcPresence.textContent = `Mohit (${gameState.player.body.posture}) & Aria (${gameState.ai.body.posture})`;
    } else if (hasPlayer) {
      hcPresence.textContent = `Mohit (${gameState.player.body.posture})`;
    } else if (hasAi) {
      hcPresence.textContent = 'Aria (Out of sight)';
    } else {
      hcPresence.textContent = 'Unoccupied right now';
    }

    hcActionsRow.style.display = 'flex';
    const allObjects = gameState.world?.objects || [];
    const roomObjCount = allObjects.filter(o => o.roomId === roomId).length;
    hcActions.textContent = `${roomObjCount} Interactive objects · Left-click floor to navigate`;

    hcDetailsRow.style.display = 'none';
    hcHint.textContent = isCurrent ? 'You are currently inside this room · Esc to close' : `Left-click floor to walk to ${roomName} ›`;

    mapHovercard.classList.add('is-visible');
    mapHovercard.setAttribute('aria-hidden', 'false');
    updateHovercardPosition(e, targetElem);
    return;
  }

  // 4. Windows
  const windowElem = targetElem.closest('.map-window') || targetElem.closest('.map-window-label') || targetElem.closest('.map-window-label-vert');
  if (windowElem) {
    hcIcon.textContent = '🪟';
    hcTitle.textContent = 'Glass Window Grill';
    hcCategory.textContent = 'ARCHITECTURE';
    hcStatus.textContent = 'Open Breeze';
    hcStatus.className = 'hovercard-status-badge status-blue';
    hcDesc.textContent = 'Sliding window grill framing leafy neem trees and letting in fresh Jabalpur morning breeze and natural daylight.';
    hcLocationRow.style.display = 'flex';
    hcLocation.textContent = 'Exterior Window';
    hcPresenceRow.style.display = 'none';
    hcActionsRow.style.display = 'none';
    hcDetailsRow.style.display = 'none';
    hcHint.textContent = 'Natural light & ventilation · Esc to close';

    mapHovercard.classList.add('is-visible');
    mapHovercard.setAttribute('aria-hidden', 'false');
    updateHovercardPosition(e, targetElem);
    return;
  }

  // 5. Doorways / Corridor
  const doorElem = targetElem.closest('.doorway-opening') || targetElem.closest('.map-corridor-label');
  if (doorElem) {
    hcIcon.textContent = '🚪';
    hcTitle.textContent = 'Connecting Hallway & Doors';
    hcCategory.textContent = 'CIRCULATION';
    hcStatus.textContent = 'Open Passage';
    hcStatus.className = 'hovercard-status-badge status-green';
    hcDesc.textContent = 'Central hallway linking all rooms. Characters easily step through doorways when in standing posture.';
    hcLocationRow.style.display = 'flex';
    hcLocation.textContent = 'Central Corridor';
    hcPresenceRow.style.display = 'none';
    hcActionsRow.style.display = 'none';
    hcDetailsRow.style.display = 'none';
    hcHint.textContent = 'Step through doors to transition rooms · Esc to close';

    mapHovercard.classList.add('is-visible');
    mapHovercard.setAttribute('aria-hidden', 'false');
    updateHovercardPosition(e, targetElem);
    return;
  }

  // Default: hide
  hideHovercard();
}

function initMapHovercard() {
  if (!houseMapSvg || !mapCanvasFrame || !mapHovercard) return;

  const hcCloseBtn = document.getElementById('hc-close-btn');
  if (hcCloseBtn) {
    hcCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hideHovercard();
    });
  }

  // Right-click on map elements reveals the info card
  houseMapSvg.addEventListener('contextmenu', (e) => {
    const target = e.target.closest('.interactive-obj') ||
                   e.target.closest('.avatar-map-token') ||
                   e.target.closest('.map-window') ||
                   e.target.closest('.map-window-label') ||
                   e.target.closest('.map-window-label-vert') ||
                   e.target.closest('.doorway-opening') ||
                   e.target.closest('.map-corridor-label') ||
                   e.target.closest('.room-zone');

    if (target) {
      e.preventDefault();
      e.stopPropagation();
      currentHoverTarget = target;
      showHovercardForTarget(target, e);
    }
  });

  // Light dismiss: clicking anywhere outside the info card closes it
  document.addEventListener('pointerdown', (e) => {
    if (mapHovercard && mapHovercard.classList.contains('is-visible')) {
      if (!mapHovercard.contains(e.target)) {
        hideHovercard();
      }
    }
  });

  // Prevent interactions inside the card from bubbling to document pointerdown
  mapHovercard.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
  });

  // Keyboard accessibility: Escape key dismisses the info card
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mapHovercard.classList.contains('is-visible')) {
      hideHovercard();
    }
  });
}

// ============================================================
// 6. CURRENT ROOM SCENE HERO (IMAGE IN BACKGROUND, TAGS ON TOP)
// ============================================================

function renderCurrentRoomScene(roomDetails, time, narr) {
  const room = roomDetails.room;
  currentRoomName.textContent = room.name;
  roomAmbienceTag.textContent = `${getAmbienceEmoji(time.timeOfDay)} ${capitalize(time.timeOfDay)} Light`;
  roomDescription.textContent = narr.room_description || room.description;
  roomAmbience.textContent = narr.room_ambience || roomDetails.ambience;

  // Update room hero background image
  if (roomHeroImage) {
    const scenePath = ROOM_SCENES[room.id] || ROOM_SCENES.bedroom;
    roomHeroImage.src = scenePath;
  }

  // Render clickable object chips
  renderRoomObjects(roomDetails.objects);
}

function renderRoomObjects(objects) {
  roomObjectsList.innerHTML = '';
  if (!objects || objects.length === 0) {
    roomObjectsList.innerHTML = '<span style="color: var(--text-faint); font-size: 12px;">Quiet space with no objects</span>';
    return;
  }

  for (const obj of objects) {
    const chip = document.createElement('div');
    chip.className = 'thing-chip';
    const stateDescription = obj.stateDescriptions?.[obj.currentState] || obj.description;
    chip.innerHTML = `<span>${obj.icon || '📦'}</span><span>${obj.name}<small>${stateDescription}</small></span>`;
    chip.onclick = () => openObjectModal(obj.id);
    roomObjectsList.appendChild(chip);
  }
}

function renderHeldItem(player) {
  const heldObjectId = player.holding?.objectId;
  const heldObject = gameState?.world?.objects?.find(object => object.id === heldObjectId) || null;

  if (!heldObject) {
    holdingPack.hidden = true;
    heldItemLabel.textContent = 'Hands are free';
    btnPutDownItem.disabled = true;
    return;
  }

  holdingPack.hidden = false;
  heldItemLabel.textContent = `${heldObject.icon || '📦'} ${heldObject.name}`;
  btnPutDownItem.disabled = false;
}

// ============================================================
// 7. INTERACTIVE OBJECT MODAL (CLICK FURNITURE ON MAP)
// ============================================================

function openObjectModal(objectId) {
  if (!gameState) return;
  const allObjects = gameState.world?.objects || gameState.roomDetails?.objects || [];
  const obj = allObjects.find(o => o.id === objectId);

  const objName = obj?.name || 'Object';
  const objIcon = obj?.icon || '📦';
  const objDesc = obj?.description || 'Select an action to perform with this object:';

  objModalIcon.textContent = objIcon;
  objModalName.textContent = objName;
  objModalDesc.textContent = objDesc;
  objModalActions.innerHTML = '';

  // Filter actions that relate to this object
  const currentState = obj?.currentState || gameState.roomDetails.objects.find(item => item.id === objectId)?.currentState;
  const relevantActions = (obj?.interactions || [])
    .map(actionId => gameState.availableActions.find(action => action.id === actionId))
    .filter((action) => {
      if (!action) return false;
      const { objectState, objectStateNot } = action.preconditions || {};
      if (objectState) {
        const allowed = Array.isArray(objectState) ? objectState : [objectState];
        if (!allowed.includes(currentState)) return false;
      }
      if (objectStateNot) {
        const blocked = Array.isArray(objectStateNot) ? objectStateNot : [objectStateNot];
        if (blocked.includes(currentState)) return false;
      }
      return true;
    });

  if (relevantActions.length === 0) {
    objModalActions.innerHTML = '<p style="color: var(--text-faint); font-size: 13px; padding: 12px; font-style: italic;">No specific actions available right now.</p>';
  } else {
    for (const act of relevantActions) {
      const btn = document.createElement('button');
      btn.className = 'obj-action-btn';
      const label = act.id === 'pick_up_item'
        ? `Pick up ${obj?.name || 'item'}`
        : act.id === 'read_book'
          ? `Read ${obj?.name || 'book'}`
          : act.name;
      btn.textContent = `${act.icon || '✨'} ${label}  ›`;
      btn.onclick = () => {
        objInteractModal.close();
        submitAction(act.id, act.requiresTarget ? objectId : undefined);
      };
      objModalActions.appendChild(btn);
    }
  }

  const containedObjects = (obj?.containedObjectIds || [])
    .map(id => allObjects.find(item => item.id === id))
    .filter(item => item && item.roomId === gameState.player.location.roomId);
  if (containedObjects.length) {
    const contentsHeading = document.createElement('p');
    contentsHeading.className = 'object-contents-heading';
    contentsHeading.textContent = 'On this shelf';
    objModalActions.appendChild(contentsHeading);
    for (const item of containedObjects) {
      const pickUp = gameState.availableActions.find(action => action.id === 'pick_up_item');
      const button = document.createElement('button');
      button.className = 'obj-action-btn';
      button.disabled = !pickUp;
      button.textContent = `🤲 Pick up ${item.name}  ›`;
      button.onclick = () => {
        objInteractModal.close();
        submitAction('pick_up_item', item.id);
      };
      objModalActions.appendChild(button);
    }
  }

  objInteractModal.showModal();
}

// ============================================================
// 8. ARIA CHAT STREAM & ACTIONS LIST
// ============================================================

function renderAria(ai, player, narr = {}, isTogether = false) {
  const roomName = capitalize(ai.location.roomId.replace('_', ' '));
  aiLocationBadge.textContent = narr.ai_location || `Online · In ${roomName}`;
  aiActivityText.textContent = narr.ai_activity || formatAiActivity(ai.activity.current);

  if (ariaRoomBadge) {
    if (isTogether) {
      ariaRoomBadge.textContent = 'Together in Room';
      ariaRoomBadge.className = 'badge-room-status status-together';
    } else {
      ariaRoomBadge.textContent = `In ${roomName} · Out of sight`;
      ariaRoomBadge.className = 'badge-room-status status-separate';
    }
  }

  btnTalkAria.disabled = sendingMessage || !isTogether;
  ariaMessageInput.disabled = !isTogether;
  btnTalkAria.style.opacity = isTogether ? '1' : '0.5';
  btnTalkAria.title = isTogether ? 'Send message to Aria' : 'Walk into the same room to talk';

  if (activeConversation && activeConversation.messages) {
    renderChatStream(activeConversation.messages);
  } else {
    chatMessagesContainer.replaceChildren();
    appendChatMessage('aria', 'Good morning! Jabalpur mornings are so peaceful, aren’t they?', '08:48 AM', false);
  }
}

function renderChatStream(messages, animateLast = false) {
  chatMessagesContainer.replaceChildren();
  const chatMessages = messages || [];
  for (const [index, msg] of chatMessages.entries()) {
    appendChatMessage(msg.sender, msg.text, msg.time, false, animateLast && index === chatMessages.length - 1);
  }
  if (sendingMessage) {
    ariaTyping.hidden = false;
    ariaTyping.classList.add('is-visible');
    chatMessagesContainer.appendChild(ariaTyping);
  } else {
    ariaTyping.hidden = true;
    ariaTyping.classList.remove('is-visible');
    if (ariaTyping.parentNode) ariaTyping.remove();
  }
  scrollChatToBottom();
}

function appendChatMessage(sender, text, timeStr, autoScroll = true, animate = false) {
  const isAria = sender === 'aria';
  const wrap = document.createElement('div');
  wrap.className = `chat-bubble-wrap ${isAria ? 'aria' : 'player'}${animate ? ' message-enter' : ''}`;

  if (isAria) {
    const avatar = document.createElement('div');
    avatar.className = 'bubble-avatar-tiny';
    avatar.textContent = 'A';
    wrap.appendChild(avatar);
  }

  const content = document.createElement('div');
  content.className = 'bubble-content';
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.textContent = text.replace(/^"|"$/g, '');
  const meta = document.createElement('span');
  meta.className = 'bubble-meta';
  meta.append(document.createTextNode(timeStr || 'Just now'));
  if (!isAria) {
    const check = document.createElement('span');
    check.className = 'meta-check';
    check.textContent = '✓✓';
    meta.append(' ', check);
  }
  content.append(bubble, meta);
  wrap.appendChild(content);
  chatMessagesContainer.appendChild(wrap);
  if (autoScroll) scrollChatToBottom();
  return wrap;
}

function renderActions(actions) {
  actionsGrid.innerHTML = '';
  const filtered = currentCategory === 'all'
    ? actions
    : actions.filter(a => a.category === currentCategory);

  if (filtered.length === 0) {
    actionsGrid.innerHTML = `<p style="color: var(--text-faint); font-size: 13px; padding: 12px; font-style: italic;">Nothing to do in this category right now.</p>`;
    return;
  }

  for (const act of filtered) {
    const row = document.createElement('div');
    row.className = 'action-row-card';
    row.onclick = () => handleActionClick(act);

    row.innerHTML = `
      <div class="action-row-left">
        <div class="action-row-icon-box">
          <span>${act.icon}</span>
        </div>
        <div>
          <div class="action-row-title">${act.name}</div>
          <div class="action-row-desc">${act.description}</div>
        </div>
      </div>
      <span class="action-row-arrow">›</span>
    `;

    actionsGrid.appendChild(row);
  }
}

function handleActionClick(act) {
  submitAction(act.id);
}

function renderPlayerQuickActions(actions) {
  if (!playerQuickActionsRow) return;
  playerQuickActionsRow.innerHTML = '';
  const acts = actions || [];
  if (playerQuickActionsCount) {
    playerQuickActionsCount.textContent = `${acts.length} ready`;
  }

  if (acts.length === 0) {
    playerQuickActionsRow.innerHTML = '<span style="font-size: 11px; color: var(--text-faint); padding: 4px;">No quick actions available</span>';
    return;
  }

  for (const act of acts) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chat-action-chip';
    chip.title = act.description || act.name;
    chip.innerHTML = `<span class="chip-icon">${act.icon || '⚡'}</span><span class="chip-text">${act.name}</span>`;
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      handleActionClick(act);
    });
    playerQuickActionsRow.appendChild(chip);
  }
}

function renderAiAvailableActions(actions) {
  if (!aiAvailableActionsList) return;
  aiAvailableActionsList.innerHTML = '';
  const acts = actions || [];

  if (aiStatusSubtext) {
    aiStatusSubtext.textContent = `${acts.length} actions available · Autonomous AI`;
  }

  if (acts.length === 0) {
    aiAvailableActionsList.innerHTML = '<div style="font-size: 12px; color: var(--text-faint); padding: 12px; text-align: center;">No actions available for Aria right now.</div>';
    return;
  }

  for (const act of acts) {
    const item = document.createElement('div');
    item.className = 'ai-action-item';
    item.title = `Ask Aria to perform: ${act.name}`;
    item.innerHTML = `
      <div class="ai-action-left">
        <span class="ai-act-icon">${act.icon || '✨'}</span>
        <div class="ai-act-meta">
          <div class="ai-act-name">${act.name}</div>
          <div class="ai-act-cat">${(act.category || 'general').toUpperCase()} · ${Math.ceil((act.duration || 0) / 60)}m</div>
        </div>
      </div>
      <button type="button" class="btn-ai-act-chip" title="Direct Aria to perform this">Act ›</button>
    `;
    item.addEventListener('click', () => {
      triggerAiAction(act.actionId);
    });
    aiAvailableActionsList.appendChild(item);
  }
}

async function triggerAiAction(actionId) {
  const finishActivity = startGameActivity('Aria is deciding…');
  if (btnAiAct) {
    btnAiAct.disabled = true;
    btnAiAct.classList.add('loading');
  }
  try {
    const payload = actionId ? { actionId } : {};
    const res = await fetch('/api/ai/act', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to trigger AI action');

    const exec = data.execution;
    const actName = exec?.actionName || exec?.actionId || 'Autonomous Action';
    const reason = exec?.reasoning ? ` (${exec.reasoning})` : '';
    showToast(`✨ Aria: ${actName}${reason}`);

    if (exec?.result?.edits) {
      applyAiEdits(exec.result.edits, true);
    }

    await fetchState();
    if (exec?.result?.status === 'accepted') {
      window.dispatchEvent(new CustomEvent('houseStateUpdated', {
        detail: {
          feedback: {
            actor: 'ai',
            floatText: {
              actor: 'ai',
              text: actName,
              color: '#d8b4fe'
            }
          }
        }
      }));
    }
  } catch (err) {
    console.error('Trigger AI action error:', err);
    showToast('Aria could not perform action right now');
  } finally {
    finishActivity();
    if (btnAiAct) {
      btnAiAct.disabled = false;
      btnAiAct.classList.remove('loading');
    }
  }
}

async function resetPhysicalNeeds() {
  const confirmed = window.confirm("Reset Mohit and Aria's physical needs to their starting values? Time, positions, home layout, and chats will be kept.");
  if (!confirmed) return;

  try {
    if (btnResetStory) {
      btnResetStory.disabled = true;
      btnResetStory.textContent = 'Resetting...';
    }
    const res = await fetch('/api/reset', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to reset physical needs');

    showToast('🔄 Physical needs reset to their starting values');
    await fetchState();
  } catch (err) {
    console.error('Reset physical needs error:', err);
    showToast('Failed to reset physical needs');
  } finally {
    if (btnResetStory) {
      btnResetStory.disabled = false;
      btnResetStory.textContent = '🔄 Reset Needs';
    }
  }
}

function renderAlerts(alerts) {
  alertsContainer.innerHTML = '';
  if (!alerts || alerts.length === 0) return;

  for (const a of alerts) {
    const div = document.createElement('div');
    const isCrit = a.includes('CRITICAL');
    div.className = `sensation-alert ${isCrit ? 'critical' : 'warning'}`;
    const cleanMsg = a.replace(/🚨 CRITICAL: |⚠️ WARNING: /g, '');
    div.innerHTML = `<span>${isCrit ? '⚠️' : '💡'}</span><span>${cleanMsg}</span>`;
    alertsContainer.appendChild(div);
  }
}

// ============================================================
// 9. CONVERSATION MANAGEMENT MODAL
// ============================================================

async function openConversationModal() {
  try {
    convModal.showModal();
    const res = await fetch('/api/conversations');
    const data = await res.json();
    renderConversationList(data.conversations, data.activeId);
  } catch (err) {
    showToast('Could not load conversation history');
  }
}

function renderConversationList(conversations, activeId) {
  convSessionsList.innerHTML = '';
  if (!conversations || conversations.length === 0) {
    convSessionsList.innerHTML = '<p style="color: var(--text-faint); font-size: 13px; padding: 12px; font-style: italic;">No previous conversations yet.</p>';
    return;
  }

  for (const conv of conversations) {
    const item = document.createElement('div');
    const isActive = conv.id === activeId;
    item.className = `conv-session-item ${isActive ? 'active' : ''}`;
    
    const lastActive = conv.lastActiveAt 
      ? new Date(conv.lastActiveAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'Recent';

    item.innerHTML = `
      <div>
        <div class="conv-session-title">${conv.title || 'Untitled Chat'}</div>
        <div class="conv-session-time">${conv.messages?.length || 0} messages • ${lastActive}</div>
      </div>
      ${isActive ? '<span class="conv-active-badge">Active</span>' : ''}
    `;

    item.onclick = async () => {
      try {
        const selectRes = await fetch('/api/conversations/select', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: conv.id }),
        });
        const selectData = await selectRes.json();
        if (selectData.activeConversation) {
          activeConversation = selectData.activeConversation;
          renderChatStream(activeConversation.messages);
          showToast(`Switched to: ${conv.title}`);
        }
        convModal.close();
      } catch (err) {
        showToast('Could not switch conversation');
      }
    };

    convSessionsList.appendChild(item);
  }
}

async function startNewConversation() {
  try {
    const res = await fetch('/api/conversations/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `Conversation with Aria (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` }),
    });
    const data = await res.json();
    if (data.activeConversation) {
      activeConversation = data.activeConversation;
      renderChatStream(activeConversation.messages);
      showToast('✨ Started a new conversation!');
    }
    convModal.close();
  } catch (err) {
    showToast('Failed to start new conversation');
  }
}

// ============================================================
// 10. HELPER FUNCTIONS & LISTENERS
// ============================================================

function transitionRoomScene(roomId) {
  applyRoomTheme(roomId);
  const imagePath = ROOM_SCENES[roomId];
  if (!imagePath) return;

  const currentLayer = document.getElementById(activeBackdropLayer === 0 ? 'room-backdrop-a' : 'room-backdrop-b');
  if (!currentLayer.style.backgroundImage) {
    currentLayer.style.backgroundImage = `url("${imagePath}")`;
    currentLayer.classList.add('is-visible');
    currentBackdropRoom = roomId;
    return;
  }

  if (roomId === currentBackdropRoom) return;

  const changeId = ++backdropChangeId;
  const nextLayerIndex = activeBackdropLayer === 0 ? 1 : 0;
  const nextLayer = document.getElementById(nextLayerIndex === 0 ? 'room-backdrop-a' : 'room-backdrop-b');
  const previousLayer = document.getElementById(activeBackdropLayer === 0 ? 'room-backdrop-a' : 'room-backdrop-b');
  const preload = new Image();

  preload.onload = () => {
    if (changeId !== backdropChangeId) return;
    nextLayer.style.backgroundImage = `url("${imagePath}")`;
    requestAnimationFrame(() => {
      nextLayer.classList.add('is-visible');
      previousLayer.classList.remove('is-visible');
    });
    currentBackdropRoom = roomId;
    activeBackdropLayer = nextLayerIndex;
  };
  preload.src = imagePath;
}

function applyRoomTheme(roomId) {
  const map = {
    bedroom: 'themes/room-bedroom.css',
    study_room: 'themes/room-study.css',
    kitchen: 'themes/room-kitchen.css',
    toilet: 'themes/room-bathroom.css',
    living_room: 'themes/room-living_room.css',
    balcony: 'themes/room-balcony.css',
  };
  const themePath = map[roomId] || map.bedroom;
  const link = document.getElementById('room-theme-link');
  if (link && !link.getAttribute('href').endsWith(themePath)) {
    link.setAttribute('href', themePath);
  }
  document.body.dataset.currentRoom = roomId;
}

function applyAiEdits(edits, animate = true) {
  if (!edits || typeof edits !== 'object') return;
  for (const [tag, value] of Object.entries(edits)) {
    if (!value) continue;
    const targets = document.querySelectorAll(`[data-ai-tag="${tag}"]`);
    targets.forEach((el) => {
      el.textContent = tag === 'dialogue' && !value.startsWith('"') ? `"${value}"` : value;
      if (animate) {
        el.classList.remove('ai-updated');
        void el.offsetWidth;
        el.classList.add('ai-updated');
        setTimeout(() => el.classList.remove('ai-updated'), 2000);
      }
    });
  }
}

function format12Hour(clockStr) {
  if (!clockStr) return '08:50 AM';
  const parts = clockStr.split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const hStr = h < 10 ? `0${h}` : `${h}`;
  return `${hStr}:${m} ${ampm}`;
}

function getDayName(d) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return days[d] || 'Tuesday';
}

function getAmbienceEmoji(timeOfDay) {
  switch (timeOfDay) {
    case 'morning': return '☀️';
    case 'afternoon': return '🌤️';
    case 'evening': return '🌆';
    case 'night': return '🌙';
    default: return '☀️';
  }
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatAiActivity(act) {
  const map = {
    studying: 'Studying and taking notes',
    resting: 'Resting quietly',
    reading: 'Reading an engaging book',
    read_book: 'Reading an engaging book',
    use_computer: 'Browsing articles on the computer',
    cook_meal: 'Cooking a fresh meal at the stove',
    sleep: 'Fast asleep in bed',
    idle: 'Taking a quiet breath',
  };
  return map[act] || act.replace(/_/g, ' ');
}

function getNaturalPoseSummary(player) {
  const { posture } = player.body;
  const room = player.location.roomId;
  const position = player.location.positionId || 'default';

  if (posture === 'lying') return 'Lying comfortably in bed';
  if (posture === 'sitting') {
    if (room === 'study_room') return 'Sitting at the study desk';
    if (room === 'kitchen') return 'Resting on the kitchen stool';
    if (position.includes('door')) return 'Sitting near the doorway';
    return 'Sitting relaxed';
  }
  if (position.includes('door')) return 'Standing by the doorway';
  if (position.includes('bookshelf')) return 'Standing by the bookshelf';
  if (position.includes('counter') || position.includes('stove')) return 'Standing by the counter';
  if (position.includes('bed')) return 'Standing beside the bed';
  return 'Standing on your feet';
}

function getDetailedPhysicalDescription(player) {
  const { posture } = player.body;
  const pos = player.location.positionId || 'default';
  const room = player.location.roomId;

  if (room === 'bedroom' && pos === 'bed_center' && posture === 'lying') {
    return 'Lying sideways on the soft cotton mattress, one shoulder sinking deeper into the pillow while the legs rest loose and easy. Breathing is slow and easy with the room still warm and quiet.';
  }
  if (room === 'bedroom' && posture === 'sitting') {
    return 'Sitting on the edge of the bed with feet planted lightly on the floor, shoulders relaxed and hands resting comfortably at the knees.';
  }
  if (room === 'study_room' && posture === 'sitting') {
    return 'Seated upright in the desk chair with the spine aligned and hands resting naturally near the keyboard. The posture is steady and focused without feeling stiff.';
  }
  if (room === 'study_room' && posture === 'standing' && pos.includes('bookshelf')) {
    return 'Standing by the bookshelf with one hand lightly against the wooden frame, weight balanced and body relaxed while the other hand holds the book or hovers near it.';
  }
  if (room === 'kitchen' && posture === 'standing') {
    return 'Standing beside the counter with weight shifted lightly between both feet, hands loose and ready near the stove or sink, body naturally balanced for movement.';
  }
  if (room === 'toilet' && posture === 'standing') {
    return 'Standing squarely in the bathroom, feet steady on the floor, shoulders relaxed and the body easy and grounded as the room settles around you.';
  }
  if (pos.includes('door')) {
    return 'Standing by the doorway with one shoulder angled toward the room, weight resting on a relaxed foot while the body remains ready to move.';
  }
  return `Standing comfortably in ${room.replace('_', ' ')}, balanced and present in the room with the body relaxed and ready for the next action.`;
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 3500);
}

function scrollChatToBottom() {
  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

// ============================================================
// 11. EVENT LISTENERS
// ============================================================

// Top-Down Map Room Clicking (Walk to room)
document.querySelectorAll('.room-zone').forEach((zone) => {
  zone.addEventListener('click', (e) => {
    // If clicked on an interactive object, let the object handler take it
    if (e.target.closest('.interactive-obj')) return;
    const targetRoom = zone.dataset.room;
    if (gameState && gameState.player.location.roomId !== targetRoom) {
      submitAction(`walk_to_${targetRoom}`);
    }
  });
});

// Top-Down Map Object Clicking (Interact with object)
document.querySelectorAll('.interactive-obj').forEach((objElem) => {
  objElem.addEventListener('click', (e) => {
    e.stopPropagation();
    const objId = objElem.dataset.obj;
    const objRoom = objElem.dataset.room;

    // If player is in another room, walk there first or prompt
    if (gameState && gameState.player.location.roomId !== objRoom) {
      showToast(`Walking to ${capitalize(objRoom.replace('_', ' '))} first...`);
      submitAction(`walk_to_${objRoom}`).then(() => {
        openObjectModal(objId);
      });
    } else {
      openObjectModal(objId);
    }
  });
});

// Category Filter Pills
document.querySelectorAll('.cat-pill').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cat-pill').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentCategory = btn.dataset.category;
    if (gameState) renderActions(gameState.availableActions);
  });
});

// Chat Send & Enter key
btnTalkAria.addEventListener('click', talkToAria);
ariaMessageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') talkToAria();
});
ariaDetailsToggle?.addEventListener('click', () => toggleCharacterDetails('aria'));
playerDetailsToggle?.addEventListener('click', () => toggleCharacterDetails('player'));

// Modals
btnConvToggle.addEventListener('click', openConversationModal);
btnOpenConvDrawer.addEventListener('click', openConversationModal);
btnCloseConv.addEventListener('click', () => convModal.close());
btnNewConv.addEventListener('click', startNewConversation);

if (btnAiAct) {
  btnAiAct.addEventListener('click', () => triggerAiAction());
}
if (btnResetStory) {
  btnResetStory.addEventListener('click', resetPhysicalNeeds);
}

if (btnCloseObjModal) {
  btnCloseObjModal.addEventListener('click', () => objInteractModal.close());
}
if (btnPutDownItem) {
  btnPutDownItem.addEventListener('click', () => submitAction('put_down_item'));
}

if (timeWeatherPill) {
  timeWeatherPill.addEventListener('click', () => {
    showToast('Refreshing live Jabalpur weather...');
    fetchRealWeather();
  });
}

btnJsonInspect.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/snapshot');
    const snapshot = await res.json();
    jsonCodeView.textContent = JSON.stringify(snapshot, null, 2);
    jsonModal.showModal();
  } catch (err) {
    showToast('Failed to load JSON snapshot');
  }
});

btnCloseModal.addEventListener('click', () => jsonModal.close());
btnModalDismiss.addEventListener('click', () => jsonModal.close());
btnCopyJson.addEventListener('click', () => {
  navigator.clipboard.writeText(jsonCodeView.textContent);
  showToast('📋 World state JSON copied');
});

// ============================================================
// 12. PHASER 3 HOUSE ENGINE & COLLABORATIVE BUILDER INTEGRATION
// ============================================================

window.submitAction = submitAction;
window.showToast = showToast;
window.openObjectModal = openObjectModal;
window.syncPlayerMapPosition = async (roomId, gridX, gridY) => {
  try {
    const res = await fetch('/api/navigation/position', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, gridX, gridY })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save map position');
    await fetchState();
  } catch (error) {
    console.error('Map position sync failed:', error);
    showToast('Could not save your position', true);
  }
};

function syncPhaserHouse(player, ai, layout) {
  window.gameState = gameState;
  if (!player || !ai) return;

  const configuredObjects = gameState?.world?.objects || [];
  const roomConfigs = gameState?.world?.allRooms || [];
  const resolveCharacterMapData = (character) => {
    const { roomId, positionId } = character.location;
    const mapPosition = character.location.mapPosition;
    const roomConfig = roomConfigs.find((room) => room.id === roomId);
    const position = roomConfig?.positions?.find((candidate) => candidate.id === positionId);
    const configuredObject = configuredObjects.find((object) =>
      object.id === position?.objectId ||
      object.id === positionId ||
      (object.roomId === roomId && object.positionId === positionId)
    );
    const placedObject = layout?.placedObjects?.find((object) =>
      object.roomId === roomId &&
      (object.id === positionId ||
        object.id === configuredObject?.id ||
        object.id === configuredObject?.houseObjectId ||
        object.templateId === configuredObject?.houseTemplateId)
    );

    let x;
    let y;
    if (mapPosition?.roomId === roomId) {
      x = mapPosition.x;
      y = mapPosition.y;
    } else if (placedObject) {
      x = placedObject.x + placedObject.width / 2;
      y = placedObject.y + placedObject.height / 2;
    } else {
      const room = layout?.rooms?.find((candidate) => candidate.id === roomId);
      if (room && position?.objectId === null && /door|entrance/i.test(positionId)) {
        const roomDoors = (layout.doors || []).filter((door) =>
          door.roomA === roomId || door.roomB === roomId
        );
        const roomCenter = { x: room.x + room.width / 2, y: room.y + room.height / 2 };
        const door = roomDoors.sort((left, right) => {
          const centerOf = (candidate) => ({
            x: candidate.x + (candidate.orientation === 'horizontal' ? candidate.width / 2 : 0.5),
            y: candidate.y + (candidate.orientation === 'vertical' ? candidate.width / 2 : 0.5)
          });
          const leftCenter = centerOf(left);
          const rightCenter = centerOf(right);
          return Math.hypot(leftCenter.x - roomCenter.x, leftCenter.y - roomCenter.y) -
            Math.hypot(rightCenter.x - roomCenter.x, rightCenter.y - roomCenter.y);
        })[0];
        if (door) {
          const doorCenter = {
            x: door.x + (door.orientation === 'horizontal' ? door.width / 2 : 0.5),
            y: door.y + (door.orientation === 'vertical' ? door.width / 2 : 0.5)
          };
          const distance = Math.hypot(roomCenter.x - doorCenter.x, roomCenter.y - doorCenter.y) || 1;
          x = doorCenter.x + (roomCenter.x - doorCenter.x) / distance * 0.6;
          y = doorCenter.y + (roomCenter.y - doorCenter.y) / distance * 0.6;
        }
      }

      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        const room = layout?.rooms?.find((candidate) => candidate.id === roomId);
        x = room ? room.x + room.width / 2 : 10;
        y = room ? room.y + room.height / 2 : 10;
      }
    }

    const heldObjectId = character.holding?.objectId || null;
    const heldObject = configuredObjects.find((object) => object.id === heldObjectId);
    return {
      id: character.id,
      name: character.name,
      roomId,
      positionId: placedObject?.id || positionId,
      posture: character.body.posture,
      x,
      y,
      holdingIcon: heldObject?.icon || null
    };
  };

  const mapLayout = layout && {
    ...layout,
    placedObjects: layout.placedObjects.flatMap((placed) => {
      const configured = configuredObjects.find((object) =>
        object.id === placed.id ||
        object.houseObjectId === placed.id ||
        object.houseTemplateId === placed.templateId
      );
      if (configured?.heldBy) return [];
      if (!configured) return [placed];

      const width = placed.width || 1;
      const height = placed.height || 1;
      return [{
        ...placed,
        roomId: configured.roomId,
        x: Number.isFinite(configured.x) ? configured.x - width / 2 : placed.x,
        y: Number.isFinite(configured.y) ? configured.y - height / 2 : placed.y,
        state: configured.currentState ?? placed.state,
        occupiedBy: configured.occupiedBy ?? null
      }];
    })
  };
  const mappedObjectIds = new Set(mapLayout?.placedObjects.map((object) => object.id) || []);
  for (const object of configuredObjects) {
    if (!Number.isFinite(object.x) || !Number.isFinite(object.y) || object.heldBy) continue;
    const alreadyMapped = mapLayout?.placedObjects.some((placed) =>
      placed.id === object.id ||
      placed.id === object.houseObjectId ||
      placed.templateId === object.houseTemplateId
    );
    if (alreadyMapped || mappedObjectIds.has(object.id)) continue;

    mapLayout?.placedObjects.push({
      id: object.id,
      templateId: object.houseTemplateId || object.id,
      name: object.name,
      type: Array.isArray(object.type) ? object.type[0] : object.type,
      roomId: object.roomId,
      x: object.x - 0.5,
      y: object.y - 0.5,
      width: 1,
      height: 1,
      rotation: 0,
      icon: object.icon,
      color: '#475569',
      state: object.currentState,
      isSolid: false,
      interactions: object.interactions,
      placedBy: 'player_001',
      placedAt: '',
      occupiedBy: object.occupiedBy ?? null
    });
  }
  const characters = {
    player: resolveCharacterMapData(player),
    ai: resolveCharacterMapData(ai)
  };

  window.dispatchEvent(new CustomEvent('houseStateUpdated', {
    detail: { layout: mapLayout, characters }
  }));
}

let houseCatalog = [];
let currentBuildCategory = 'all';

async function initPhaserHouseIntegration() {
  const tabLive = document.getElementById('tab-live-mode');
  const tabBuild = document.getElementById('tab-build-mode');
  const tabBlueprint = document.getElementById('tab-blueprint-mode');
  const phaserContainer = document.getElementById('phaser-house-container');
  const houseMapSvg = document.getElementById('house-map-svg');
  const buildModeDrawer = document.getElementById('build-mode-drawer');
  const buildCatalogList = document.getElementById('build-catalog-list');
  const buildCategoryPills = document.getElementById('build-category-pills');
  const roomFinishesPanel = document.getElementById('room-finishes-panel');
  const roomLibraryPanel = document.getElementById('room-library-panel');
  const objectInspectorPanel = document.getElementById('object-inspector-panel');
  const buildStatusText = document.getElementById('build-status-text');

  // Camera buttons
  const btnCamZoomIn = document.getElementById('btn-cam-zoom-in');
  const btnCamZoomOut = document.getElementById('btn-cam-zoom-out');
  const btnCamReset = document.getElementById('btn-cam-reset');
  const btnCamFocusMohit = document.getElementById('btn-cam-focus-mohit');
  const btnCamFocusAria = document.getElementById('btn-cam-focus-aria');
  const btnBuildDone = document.getElementById('btn-build-done');

  // Build toolbar buttons
  const btnBuildRotate = document.getElementById('btn-build-rotate');
  const btnBuildCancel = document.getElementById('btn-build-cancel');
  const btnBuildDemolish = document.getElementById('btn-build-demolish');
  const btnAriaDecorate = document.getElementById('btn-aria-decorate');
  const btnResetHouse = document.getElementById('btn-reset-house');
  const btnApplyFloor = document.getElementById('btn-apply-floor');
  const btnApplyWall = document.getElementById('btn-apply-wall');
  const btnAddRoom = document.getElementById('btn-add-room');
  const btnRemoveRoom = document.getElementById('btn-remove-room');
  const btnSaveObject = document.getElementById('btn-save-object');
  let currentHouseLayout = null;
  let selectedObjectForEdit = null;

  // 1. Fetch initial house data
  try {
    const res = await fetch('/api/house');
    if (!res.ok) throw new Error('Failed to load house data');
    const data = await res.json();
    houseCatalog = data.catalog || [];
    currentHouseLayout = data.layout || null;

    // Initialize Phaser game
    if (typeof window.initPhaserHouseGame === 'function') {
      window.initPhaserHouseGame('phaser-house-container', data);
    }

    renderBuildCategories();
    renderRoomOptions(currentHouseLayout);
    renderBuildCatalog();
  } catch (err) {
    console.error('Failed to init house:', err);
  }

  window.addEventListener('houseStateUpdated', (event) => {
    if (!event.detail?.layout) return;
    currentHouseLayout = event.detail.layout;
    renderRoomOptions(currentHouseLayout);
  });

  window.addEventListener('placedObjectSelected', (event) => {
    selectedObjectForEdit = event.detail?.object || null;
    if (!objectInspectorPanel) return;
    objectInspectorPanel.style.display = selectedObjectForEdit ? 'flex' : 'none';
    if (selectedObjectForEdit) populateObjectInspector(selectedObjectForEdit);
  });

  // 2. Mode Tabs
  function updateBuildDrawerOffset() {
    if (!document.body.classList.contains('build-map-fullscreen')) return;
    const header = document.querySelector('.home-card-header');
    if (header) {
      document.body.style.setProperty(
        '--build-drawer-top',
        `${Math.ceil(header.getBoundingClientRect().height + 8)}px`
      );
    }
  }

  window.addEventListener('resize', updateBuildDrawerOffset);

  function setMode(mode) {
    tabLive?.classList.toggle('active', mode === 'live');
    tabLive?.setAttribute('aria-selected', mode === 'live' ? 'true' : 'false');

    tabBuild?.classList.toggle('active', mode === 'build');
    tabBuild?.setAttribute('aria-selected', mode === 'build' ? 'true' : 'false');

    tabBlueprint?.classList.toggle('active', mode === 'blueprint');
    tabBlueprint?.setAttribute('aria-selected', mode === 'blueprint' ? 'true' : 'false');
    document.body.classList.toggle('build-map-fullscreen', mode === 'build');
    if (mode === 'build') {
      requestAnimationFrame(updateBuildDrawerOffset);
    } else {
      document.body.style.removeProperty('--build-drawer-top');
    }
    window.dispatchEvent(new CustomEvent('mapFullscreenChanged', {
      detail: { enabled: mode === 'build' }
    }));

    if (mode === 'blueprint') {
      if (phaserContainer) phaserContainer.style.display = 'none';
      if (houseMapSvg) houseMapSvg.style.display = 'block';
      if (buildModeDrawer) buildModeDrawer.style.display = 'none';
      window.dispatchEvent(new CustomEvent('setBuildMode', { detail: { enabled: false } }));
    } else if (mode === 'build') {
      if (phaserContainer) phaserContainer.style.display = 'flex';
      if (houseMapSvg) houseMapSvg.style.display = 'none';
      if (buildModeDrawer) buildModeDrawer.style.display = 'flex';
      window.dispatchEvent(new CustomEvent('setBuildMode', { detail: { enabled: true } }));
    } else {
      // live
      if (phaserContainer) phaserContainer.style.display = 'flex';
      if (houseMapSvg) houseMapSvg.style.display = 'none';
      if (buildModeDrawer) buildModeDrawer.style.display = 'none';
      window.dispatchEvent(new CustomEvent('setBuildMode', { detail: { enabled: false } }));
    }
  }

  tabLive?.addEventListener('click', () => setMode('live'));
  tabBuild?.addEventListener('click', () => setMode('build'));
  tabBlueprint?.addEventListener('click', () => setMode('blueprint'));
  btnBuildDone?.addEventListener('click', () => setMode('live'));

  // 3. Camera Controls
  btnCamZoomIn?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('cameraZoom', { detail: { direction: 'in' } }));
  });
  btnCamZoomOut?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('cameraZoom', { detail: { direction: 'out' } }));
  });
  btnCamReset?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('cameraFocus', { detail: { target: 'reset' } }));
  });
  btnCamFocusMohit?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('cameraFocus', { detail: { target: 'mohit' } }));
  });
  btnCamFocusAria?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('cameraFocus', { detail: { target: 'aria' } }));
  });

  // 4. Build Toolbar Actions
  btnBuildRotate?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('rotateGhostItem'));
  });
  btnBuildCancel?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('cancelBuildPlacement'));
    deselectCatalogCards();
  });
  btnBuildDemolish?.addEventListener('click', () => {
    const scene = window.phaserHouseGame?.scene?.keys?.HouseScene;
    if (scene) scene.removeSelectedPlacedObject();
  });
  btnSaveObject?.addEventListener('click', () => {
    if (!selectedObjectForEdit) return;
    const scene = window.phaserHouseGame?.scene?.keys?.HouseScene;
    const customData = {
      labelText: document.getElementById('edit-object-label')?.value || '',
      labelColor: document.getElementById('edit-object-label-color')?.value,
      fontSize: Number(document.getElementById('edit-object-font-size')?.value),
      edgeColor: document.getElementById('edit-object-edge-color')?.value,
      edgeWidth: Number(document.getElementById('edit-object-edge-width')?.value),
      cornerRadius: Number(document.getElementById('edit-object-corner-radius')?.value)
    };
    if (scene) {
      scene.editSelectedPlacedObject({
        name: document.getElementById('edit-object-name')?.value,
        width: Number(document.getElementById('edit-object-width')?.value),
        height: Number(document.getElementById('edit-object-height')?.value),
        rotation: Number(document.getElementById('edit-object-rotation')?.value),
        color: document.getElementById('edit-object-color')?.value,
        icon: document.getElementById('edit-object-icon')?.value,
        isSolid: !!document.getElementById('edit-object-solid')?.checked,
        customData
      });
    }
  });

  btnAddRoom?.addEventListener('click', async () => {
    const name = document.getElementById('new-room-name')?.value.trim();
    if (!name) return showToast('Enter a room name', true);
    const roomId = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}_${Date.now().toString(36)}`;
    await submitBuildCommand('add_room', {
      roomId,
      name,
      type: document.getElementById('new-room-type')?.value || 'room',
      gridX: Number(document.getElementById('new-room-x')?.value),
      gridY: Number(document.getElementById('new-room-y')?.value),
      gridWidth: Number(document.getElementById('new-room-width')?.value),
      gridHeight: Number(document.getElementById('new-room-height')?.value)
    });
  });

  btnRemoveRoom?.addEventListener('click', async () => {
    const roomId = document.getElementById('select-library-room')?.value;
    const room = currentHouseLayout?.rooms?.find((item) => item.id === roomId);
    if (!room) return;
    if (!confirm(`Delete "${room.name}" and everything placed inside it?`)) return;
    await submitBuildCommand('remove_room', { roomId });
  });

  async function submitBuildCommand(action, params) {
    try {
      const response = await fetch('/api/house/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, params })
      });
      const data = await response.json();
      if (!data.success || !data.layout) {
        showToast(data.message || `Could not ${action.replace('_', ' ')}`, true);
        return false;
      }
      window.dispatchEvent(new CustomEvent('houseStateUpdated', { detail: { layout: data.layout } }));
      showToast(data.message || 'Home updated');
      return true;
    } catch (error) {
      console.error(`House ${action} failed:`, error);
      showToast('Could not update the home');
      return false;
    }
  }

  function renderBuildCategories() {
    if (!buildCategoryPills) return;
    const labels = {
      all: 'All',
      seating: '🪑 Seating',
      tables: '🪵 Tables',
      beds: '🛏️ Beds',
      storage: '📦 Storage',
      appliances: '🍳 Appliances',
      lighting: '💡 Lighting',
      plants: '🪴 Plants',
      decor: '🎨 Decor',
      fixtures: '🔧 Fixtures'
    };
    const categories = ['all', ...new Set(houseCatalog.map((item) => item.category).filter(Boolean)), 'finishes', 'rooms'];
    const extras = { finishes: '🧱 Finishes', rooms: '🏠 Rooms' };
    buildCategoryPills.replaceChildren();
    categories.forEach((category) => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `build-cat-pill${category === currentBuildCategory ? ' active' : ''}`;
      pill.dataset.category = category;
      pill.textContent = extras[category] || labels[category] || category.replace(/_/g, ' ');
      buildCategoryPills.appendChild(pill);
    });
  }

  function renderRoomOptions(layout) {
    if (!layout?.rooms) return;
    ['select-finish-room', 'select-library-room'].forEach((id) => {
      const select = document.getElementById(id);
      if (!select) return;
      const previous = select.value;
      select.replaceChildren();
      layout.rooms.forEach((room) => {
        const option = document.createElement('option');
        option.value = room.id;
        option.textContent = room.name;
        select.appendChild(option);
      });
      if (layout.rooms.some((room) => room.id === previous)) select.value = previous;
    });
  }

  function populateObjectInspector(object) {
    const setValue = (id, value) => {
      const input = document.getElementById(id);
      if (input) input.value = value;
    };
    const style = object.customData || {};
    setValue('edit-object-name', object.name);
    setValue('edit-object-width', object.width);
    setValue('edit-object-height', object.height);
    setValue('edit-object-rotation', object.rotation);
    setValue('edit-object-color', object.color || '#475569');
    setValue('edit-object-icon', object.icon || '📦');
    setValue('edit-object-label', style.labelText ?? object.name);
    setValue('edit-object-label-color', style.labelColor || '#f8fafc');
    setValue('edit-object-font-size', style.fontSize ?? 17);
    setValue('edit-object-edge-color', style.edgeColor || '#ffffff');
    setValue('edit-object-edge-width', style.edgeWidth ?? 1.5);
    setValue('edit-object-corner-radius', style.cornerRadius ?? 4);
    const solid = document.getElementById('edit-object-solid');
    if (solid) solid.checked = !!object.isSolid;
  }

  // Placed object selection listener
  window.addEventListener('placedObjectSelected', (e) => {
    const obj = e.detail?.object;
    if (obj) {
      if (btnBuildDemolish) btnBuildDemolish.style.display = 'inline-flex';
      if (buildStatusText) {
        buildStatusText.textContent = `Selected: "${obj.name}" • Press R to rotate, or Demolish to remove`;
      }
    } else {
      if (btnBuildDemolish) btnBuildDemolish.style.display = 'none';
      if (buildStatusText) {
        buildStatusText.textContent = 'Pick an item below to place, or click existing furniture to edit';
      }
    }
  });

  // Ask Aria to Decorate
  btnAriaDecorate?.addEventListener('click', async () => {
    showToast('✨ Asking Aria to inspect our space and decorate...');
    try {
      const res = await fetch('/api/house/ai-build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success && data.layout) {
        window.dispatchEvent(new CustomEvent('houseStateUpdated', {
          detail: { layout: data.layout }
        }));
        showToast(data.message || 'Aria added an enhancement!');
        if (data.proposal) {
          const scene = window.phaserHouseGame?.scene?.keys?.HouseScene;
          if (scene) scene.showCharacterSpeech('ai', data.proposal.dialogue);
          const nowClock = gameState ? format12Hour(gameState.time.clock) : 'Just now';
          appendChatMessage('aria', data.proposal.dialogue, nowClock, true, true);
        }
      } else {
        showToast(data.message || 'Aria feels the space is balanced.');
      }
    } catch (err) {
      showToast('Could not reach Aria right now');
    }
  });

  // Reset House Layout
  btnResetHouse?.addEventListener('click', async () => {
    if (!confirm('Reset the house layout to the default Jabalpur residence?')) return;
    try {
      const res = await fetch('/api/house/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.layout) {
        window.dispatchEvent(new CustomEvent('houseStateUpdated', {
          detail: { layout: data.layout }
        }));
        showToast('House layout restored to default.');
      }
    } catch (err) {
      showToast('Could not reset layout');
    }
  });

  buildCategoryPills?.addEventListener('click', (event) => {
    const pill = event.target.closest('.build-cat-pill');
    if (!pill) return;
    currentBuildCategory = pill.dataset.category || 'all';
    buildCategoryPills.querySelectorAll('.build-cat-pill').forEach((item) => {
      item.classList.toggle('active', item === pill);
    });
    const showFinishes = currentBuildCategory === 'finishes';
    const showRooms = currentBuildCategory === 'rooms';
    if (buildCatalogList) buildCatalogList.style.display = showFinishes || showRooms ? 'none' : 'grid';
    if (roomFinishesPanel) roomFinishesPanel.style.display = showFinishes ? 'flex' : 'none';
    if (roomLibraryPanel) roomLibraryPanel.style.display = showRooms ? 'flex' : 'none';
    renderBuildCatalog();
  });

  // Apply Floor Customization
  btnApplyFloor?.addEventListener('click', async () => {
    const roomId = document.getElementById('select-finish-room')?.value;
    const floorType = document.getElementById('select-finish-floor')?.value;
    if (!roomId || !floorType) return;

    try {
      const res = await fetch('/api/house/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'customize_floor',
          params: { roomId, floorType }
        })
      });

      const data = await res.json();
      if (data.success && data.layout) {
        window.dispatchEvent(new CustomEvent('houseStateUpdated', {
          detail: { layout: data.layout }
        }));
        showToast(`Updated ${capitalize(roomId.replace('_', ' '))} floor to ${floorType}!`);
      }
    } catch (err) {
      showToast('Failed to customize floor');
    }
  });

  // Apply Wall Customization
  btnApplyWall?.addEventListener('click', async () => {
    const roomId = document.getElementById('select-finish-room')?.value;
    const wallColor = document.getElementById('input-wall-color')?.value;
    if (!roomId || !wallColor) return;

    try {
      const res = await fetch('/api/house/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'customize_wall',
          params: { roomId, wallColor }
        })
      });
      const data = await res.json();
      if (data.success && data.layout) {
        window.dispatchEvent(new CustomEvent('houseStateUpdated', {
          detail: { layout: data.layout }
        }));
        showToast(`Updated ${capitalize(roomId.replace('_', ' '))} wall color!`);
      }
    } catch (err) {
      showToast('Failed to customize wall');
    }
  });
}

function deselectCatalogCards() {
  document.querySelectorAll('.build-catalog-card').forEach((c) => c.classList.remove('selected'));
}

function renderBuildCatalog() {
  const container = document.getElementById('build-catalog-list');
  if (!container) return;
  container.innerHTML = '';

  const filtered = currentBuildCategory === 'all'
    ? houseCatalog
    : houseCatalog.filter((item) => item.category === currentBuildCategory);

  for (const item of filtered) {
    const card = document.createElement('div');
    card.className = 'build-catalog-card';
    card.dataset.itemId = item.id;

    card.innerHTML = `
      <div class="build-catalog-icon">${item.icon || '📦'}</div>
      <div class="build-catalog-name">${item.name}</div>
      <div class="build-catalog-meta">
        <span class="build-catalog-badge">${item.width}×${item.height}</span>
        <span>${item.isSolid ? 'Solid' : 'Walkable'}</span>
      </div>
    `;

    card.addEventListener('click', () => {
      deselectCatalogCards();
      card.classList.add('selected');
      window.dispatchEvent(new CustomEvent('selectCatalogItem', { detail: { item } }));
      const buildStatusText = document.getElementById('build-status-text');
      if (buildStatusText) {
        buildStatusText.textContent = `Placing "${item.name}" • Click floor to build • Press R to rotate • Esc to cancel`;
      }
    });

    container.appendChild(card);
  }
}

// Hovercard Bridge for Phaser 3
window.showPhaserObjectHovercard = function (obj, rawEvent) {
  if (!mapHovercard) return;
  const allObjects = gameState?.world?.objects || [];
  const fullObj = allObjects.find((o) => o.id === obj.id) || obj;

  hcIcon.textContent = fullObj.icon || '📦';
  hcTitle.textContent = fullObj.name;
  hcCategory.textContent = (fullObj.type || 'FURNITURE').toUpperCase();
  hcStatus.textContent = fullObj.state || fullObj.currentState || 'ready';
  hcStatus.className = `hovercard-status-badge ${getStatusBadgeClass(hcStatus.textContent)}`;
  hcDesc.textContent = fullObj.description || 'Interactive household fixture.';

  hcLocationRow.style.display = 'flex';
  const roomName = capitalize((fullObj.roomId || '').replace('_', ' '));
  hcLocation.textContent = `${roomName} · Grid (${fullObj.x}, ${fullObj.y})`;

  hcPresenceRow.style.display = 'none';
  hcActionsRow.style.display = 'flex';
  const interactions = fullObj.interactions || [];
  hcActions.textContent = interactions.length > 0 ? interactions.slice(0, 3).map(formatCleanActionName).join(' · ') : 'None directly';
  hcDetailsRow.style.display = 'none';

  const isInSameRoom = gameState?.player?.location?.roomId === fullObj.roomId;
  hcHint.textContent = isInSameRoom ? 'Left-click object to interact · Esc to close' : `Walk to ${roomName} first · Esc to close`;

  mapHovercard.classList.add('is-visible');
  mapHovercard.setAttribute('aria-hidden', 'false');
  updateHovercardPosition(rawEvent, null);
};

window.showPhaserRoomHovercard = function (room, rawEvent) {
  if (!mapHovercard) return;
  const isCurrent = gameState?.player?.location?.roomId === room.id;
  const roomIcons = {
    bedroom: '🛏️', study_room: '📚', kitchen: '🍳', toilet: '🚿', living_room: '🛋️', balcony: '🌿'
  };

  hcIcon.textContent = roomIcons[room.type] || '🏠';
  hcTitle.textContent = room.name;
  hcCategory.textContent = isCurrent ? 'CURRENT LOCATION' : 'ROOM ZONE';
  hcStatus.textContent = isCurrent ? 'You are here' : 'Reachable';
  hcStatus.className = `hovercard-status-badge ${isCurrent ? 'status-green' : 'status-blue'}`;
  hcDesc.textContent = room.description || 'A comfortable space inside the Jabalpur home.';

  hcLocationRow.style.display = 'flex';
  hcLocation.textContent = `Floor: ${capitalize(room.floorType)} · Jabalpur Residence`;

  hcPresenceRow.style.display = 'flex';
  const hasPlayer = gameState?.player?.location?.roomId === room.id;
  const hasAi = gameState?.ai?.location?.roomId === room.id;
  if (hasPlayer && hasAi) hcPresence.textContent = 'Mohit & Aria together';
  else if (hasPlayer) hcPresence.textContent = 'Mohit';
  else if (hasAi) hcPresence.textContent = 'Aria';
  else hcPresence.textContent = 'Unoccupied';

  hcActionsRow.style.display = 'none';
  hcDetailsRow.style.display = 'none';
  hcHint.textContent = isCurrent ? 'You are currently inside this room' : `Click floor to walk to ${room.name} ›`;

  mapHovercard.classList.add('is-visible');
  mapHovercard.setAttribute('aria-hidden', 'false');
  updateHovercardPosition(rawEvent, null);
};

// Initial startup
initWeatherCanvas();
initMapHovercard();
initPhaserHouseIntegration();
fetchRealWeather();
updateLiveClock();
fetchState();
setInterval(updateLiveClock, 1000);
setInterval(refreshLiveVitals, 60 * 1000);
setInterval(pollGameState, 3000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) pollGameState();
});

// Refresh real weather every 10 minutes
setInterval(fetchRealWeather, 10 * 60 * 1000);

// Add grid coordinate tracking and room form auto-fill during map/build editing
document.addEventListener('DOMContentLoaded', () => {
  const mapContainer = document.getElementById('phaser-house-container');
  const inputX = document.getElementById('room-location-x') || document.getElementById('room-x');
  const inputY = document.getElementById('room-location-y') || document.getElementById('room-y');

  let coordTooltip = document.getElementById('map-coord-tooltip');
  if (!coordTooltip) {
    coordTooltip = document.createElement('div');
    coordTooltip.id = 'map-coord-tooltip';
    coordTooltip.style.position = 'absolute';
    coordTooltip.style.background = 'rgba(0, 0, 0, 0.85)';
    coordTooltip.style.color = '#fff';
    coordTooltip.style.padding = '4px 8px';
    coordTooltip.style.fontSize = '12px';
    coordTooltip.style.borderRadius = '4px';
    coordTooltip.style.pointerEvents = 'none';
    coordTooltip.style.display = 'none';
    coordTooltip.style.zIndex = '9999';
    document.body.appendChild(coordTooltip);
  }

  if (mapContainer) {
    let latestCoord = { x: 0, y: 0 };
    const tileSize = 32;

    mapContainer.addEventListener('mousemove', (e) => {
      const rect = mapContainer.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;
      const gridX = Math.floor(relX / tileSize);
      const gridY = Math.floor(relY / tileSize);

      latestCoord = { x: gridX, y: gridY };

      coordTooltip.style.display = 'block';
      coordTooltip.style.left = `${e.pageX + 12}px`;
      coordTooltip.style.top = `${e.pageY + 12}px`;
      coordTooltip.textContent = `Grid X: ${gridX}, Y: ${gridY}`;
    });

    mapContainer.addEventListener('mouseleave', () => {
      coordTooltip.style.display = 'none';
    });

    mapContainer.addEventListener('click', () => {
      if (inputX) inputX.value = latestCoord.x;
      if (inputY) inputY.value = latestCoord.y;
    });
  }
});
