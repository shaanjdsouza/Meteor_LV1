const meteorLayer = document.getElementById("meteor-layer");
const startButton = document.getElementById("start-button");
const resetButton = document.getElementById("reset-button");
const passwordBox = document.getElementById("password-box");
const rewardCard = document.getElementById("reward-card");
const stars = Array.from(document.querySelectorAll(".star"));
const EventCode = {
  BLINK: 0,
  AUDIBLE_METEOR: 1,
  SILENT_METEOR: 2,
};
const MeteorType = {
  AUDIBLE: "audible",
  SILENT: "silent",
};
const EVENT_GAP_MS = 1300;
const EVENT_ROWS = [
  [0, 2, 0, 0, 1, 1, 2, 1],
  [0, 2, 2, 0, 0, 1, 1, 1],
  [0, 1, 1, 0, 2, 0, 0, 0],
  [0, 2, 1, 1, 0, 0, 2, 1],
  [0, 1, 2, 0, 0, 2, 1, 0],
  [0, 2, 1, 0, 0, 1, 0, 2],
  [0, 2, 1, 2, 0, 1, 1, 1],
  [0, 1, 1, 2, 0, 0, 1, 0],
];
const EVENT_SEQUENCE = EVENT_ROWS.flat();
const PASSWORD = "Asteroid";

let audioContext = null;
let eventIndex = 0;
let timelineTimeoutId = null;
let isTimelineRunning = false;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function getAudioContext() {
  if (!window.AudioContext && !window.webkitAudioContext) {
    return null;
  }

  if (!audioContext) {
    const Context = window.AudioContext || window.webkitAudioContext;
    audioContext = new Context();
  }

  return audioContext;
}

function unlockAudio() {
  const context = getAudioContext();

  if (context && context.state === "suspended") {
    context.resume().catch(() => {});
  }
}

function createNoiseBuffer(context, duration) {
  const frameCount = Math.ceil(context.sampleRate * duration);
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const channel = buffer.getChannelData(0);

  for (let index = 0; index < frameCount; index += 1) {
    channel[index] = (Math.random() * 2 - 1) * 0.7;
  }

  return buffer;
}

function playWhoosh(duration) {
  const context = getAudioContext();

  if (!context || context.state !== "running") {
    return;
  }

  const startTime = context.currentTime;
  const endTime = startTime + duration;
  const source = context.createBufferSource();
  const highpass = context.createBiquadFilter();
  const bandpass = context.createBiquadFilter();
  const gain = context.createGain();
  const panner = context.createStereoPanner();

  source.buffer = createNoiseBuffer(context, duration);

  highpass.type = "highpass";
  highpass.frequency.setValueAtTime(180, startTime);

  bandpass.type = "bandpass";
  bandpass.Q.setValueAtTime(0.9, startTime);
  bandpass.frequency.setValueAtTime(420, startTime);
  bandpass.frequency.exponentialRampToValueAtTime(2200, startTime + duration * 0.48);
  bandpass.frequency.exponentialRampToValueAtTime(680, endTime);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.035, startTime + duration * 0.16);
  gain.gain.exponentialRampToValueAtTime(0.08, startTime + duration * 0.5);
  gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

  panner.pan.setValueAtTime(-0.85, startTime);
  panner.pan.linearRampToValueAtTime(0.85, endTime);

  source.connect(highpass);
  highpass.connect(bandpass);
  bandpass.connect(gain);
  gain.connect(panner);
  panner.connect(context.destination);

  source.start(startTime);
  source.stop(endTime);
}

function blinkRandomStar() {
  if (stars.length === 0) {
    return;
  }

  const star = stars[Math.floor(Math.random() * stars.length)];

  star.classList.remove("is-blinking");
  void star.offsetWidth;
  star.classList.add("is-blinking");

  window.setTimeout(() => {
    star.classList.remove("is-blinking");
  }, 500);
}

function setStartButtonState(isStarted) {
  startButton.disabled = isStarted;
  startButton.classList.toggle("is-inactive", isStarted);
}

function clearScene() {
  if (timelineTimeoutId) {
    window.clearTimeout(timelineTimeoutId);
    timelineTimeoutId = null;
  }

  meteorLayer.replaceChildren();

  for (const star of stars) {
    star.classList.remove("is-blinking");
  }
}

function showRewardCard() {
  rewardCard.hidden = false;
}

function hideRewardCard() {
  rewardCard.hidden = true;
}

function markPasswordInvalid() {
  passwordBox.classList.remove("is-invalid");
  void passwordBox.offsetWidth;
  passwordBox.classList.add("is-invalid");

  window.setTimeout(() => {
    passwordBox.classList.remove("is-invalid");
  }, 440);
}

function handlePasswordSubmit() {
  if (passwordBox.value.trim() === PASSWORD) {
    passwordBox.classList.remove("is-invalid");
    showRewardCard();
    return;
  }

  hideRewardCard();
  markPasswordInvalid();
}

function spawnMeteor(meteorType) {
  const meteor = document.createElement("div");
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const size = randomBetween(110, 220);
  const startY = randomBetween(0.08, 0.58) * viewportHeight;
  const startX = -size * 1.2;
  const travelX = viewportWidth + size * 2.4;
  const travelY = randomBetween(-90, 90);
  const angle = Math.atan2(travelY, travelX) * (180 / Math.PI);
  const duration = randomBetween(0.95, 1.15);

  meteor.className = `meteor meteor-${meteorType}`;
  meteor.dataset.meteorType = meteorType;
  meteor.style.left = `${startX}px`;
  meteor.style.top = `${startY}px`;
  meteor.style.setProperty("--meteor-size", `${size}px`);
  meteor.style.setProperty("--travel-x", `${travelX}px`);
  meteor.style.setProperty("--travel-y", `${travelY}px`);
  meteor.style.setProperty("--meteor-angle", `${angle}deg`);
  meteor.style.setProperty("--meteor-scale", randomBetween(0.78, 1.18).toFixed(2));
  meteor.style.setProperty("--meteor-duration", `${duration.toFixed(2)}s`);

  meteorLayer.appendChild(meteor);

  if (meteorType === MeteorType.AUDIBLE) {
    playWhoosh(duration);
  }

  meteor.addEventListener("animationend", () => {
    meteor.remove();
  });
}

function runEvent(eventCode) {
  if (eventCode === EventCode.BLINK) {
    blinkRandomStar();
    return;
  }

  if (eventCode === EventCode.AUDIBLE_METEOR) {
    spawnMeteor(MeteorType.AUDIBLE);
    return;
  }

  spawnMeteor(MeteorType.SILENT);
}

function advanceTimeline() {
  if (!isTimelineRunning) {
    return;
  }

  runEvent(EVENT_SEQUENCE[eventIndex]);
  eventIndex = (eventIndex + 1) % EVENT_SEQUENCE.length;
  timelineTimeoutId = window.setTimeout(advanceTimeline, EVENT_GAP_MS);
}

function startEventTimeline() {
  if (isTimelineRunning) {
    return;
  }

  unlockAudio();
  isTimelineRunning = true;
  setStartButtonState(true);
  advanceTimeline();
}

function resetLevel() {
  isTimelineRunning = false;
  eventIndex = 0;
  clearScene();
  setStartButtonState(false);
  passwordBox.value = "";
  passwordBox.classList.remove("is-invalid");
  hideRewardCard();
}

window.addEventListener("pointerdown", unlockAudio, { passive: true });
window.addEventListener("keydown", unlockAudio);
startButton.addEventListener("click", startEventTimeline);
resetButton.addEventListener("click", resetLevel);
passwordBox.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  handlePasswordSubmit();
});
