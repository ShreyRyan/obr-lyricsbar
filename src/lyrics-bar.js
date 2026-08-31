import OBR from "@owlbear-rodeo/sdk";
import { getState, onStateChange, setState } from "./sync.js";
import { parseLRC } from "./lrc.js";

const LOCK_KEY = "netease-lyrics-locked";

let state = null;
let lrcParsed = [];
let animFrame = null;
let isPlaying = false;
let localHidden = false;
let isLocked = false;
let userRole = null;

OBR.onReady(async () => {
  userRole = await OBR.player.getRole();
  document.body.classList.add(userRole === "GM" ? "role-gm" : "role-pl");

  if (userRole === "GM") {
    bindControls();
  } else {
    document.getElementById("controls-row")?.classList.add("hidden");
    document.getElementById("btn-local-viz")?.addEventListener("click", localToggle);
  }

  isLocked = localStorage.getItem(LOCK_KEY) === "true";
  if (isLocked) document.body.classList.add("lyrics-bar-locked");
  updateLockBtn();

  document.getElementById("btn-lock")?.addEventListener("click", toggleLock);

  const initial = await getState();
  handleState(initial);
  onStateChange(handleState);
});

function localToggle() {
  localHidden = !localHidden;
  const btn = document.getElementById("btn-local-viz");
  const row = document.querySelector(".lyrics-row");
  if (btn) btn.textContent = localHidden ? "👁 显示" : "👁 隐藏";
  if (row) row.style.display = localHidden ? "none" : "";
  const handle = document.getElementById("lyrics-bar-handle");
  if (handle) handle.style.display = localHidden ? "none" : "";
}

function toggleLock() {
  isLocked = !isLocked;
  localStorage.setItem(LOCK_KEY, String(isLocked));
  if (isLocked) {
    document.body.classList.add("lyrics-bar-locked");
  } else {
    document.body.classList.remove("lyrics-bar-locked");
  }
  updateLockBtn();
}

function updateLockBtn() {
  const btn = document.getElementById("btn-lock");
  if (btn) btn.textContent = isLocked ? "🔒" : "🔓";
}

function bindControls() {
  document.getElementById("btn-play")?.addEventListener("click", () => play());
  document.getElementById("btn-pause")?.addEventListener("click", () => pause());
  document.getElementById("btn-stop")?.addEventListener("click", () => stop());
  document.getElementById("btn-toggle-viz")?.addEventListener("click", toggleViz);
  document.getElementById("btn-offset-minus")?.addEventListener("click", () => shift(-0.1));
  document.getElementById("btn-offset-plus")?.addEventListener("click", () => shift(0.1));
}

async function play() {
  if (!state) return;
  await setState({
    songId: state.songId, songName: state.songName, artist: state.artist,
    lrcRaw: state.lrcRaw, elapsed: state.elapsed || 0, isPlaying: true,
    offset: state.offset || 0, timestamp: Date.now(), visible: state.visible !== false,
  });
}

async function pause() {
  if (!state) return;
  const elapsed = (state.elapsed || 0) + (state.isPlaying ? Date.now() - state.timestamp : 0);
  await setState({
    songId: state.songId, songName: state.songName, artist: state.artist,
    lrcRaw: state.lrcRaw, elapsed, isPlaying: false,
    offset: state.offset || 0, timestamp: Date.now(), visible: state.visible !== false,
  });
}

async function stop() {
  if (!state) return;
  await setState({
    songId: state.songId, songName: state.songName, artist: state.artist,
    lrcRaw: state.lrcRaw, elapsed: 0, isPlaying: false,
    offset: 0, timestamp: Date.now(), visible: true,
  });
}

async function toggleViz() {
  if (!state) return;
  const newVis = state.visible === false;
  await setState({
    songId: state.songId, songName: state.songName, artist: state.artist,
    lrcRaw: state.lrcRaw, elapsed: state.elapsed || 0, isPlaying: state.isPlaying || false,
    offset: state.offset || 0, timestamp: Date.now(), visible: newVis,
  });
}

async function shift(delta) {
  if (!state) return;
  const elapsed = (state.elapsed || 0) + (state.isPlaying ? Date.now() - state.timestamp : 0);
  const newOffset = (state.offset || 0) + delta;
  await setState({
    songId: state.songId, songName: state.songName, artist: state.artist,
    lrcRaw: state.lrcRaw, elapsed, isPlaying: state.isPlaying || false,
    offset: newOffset, timestamp: Date.now(), visible: state.visible !== false,
  });
}

function handleState(newState) {
  if (!newState || newState.visible === false) {
    state = null; lrcParsed = [];
    cancelAnimationFrame(animFrame);
    document.querySelector(".lyrics-prev").textContent = "";
    document.querySelector(".lyrics-current").textContent = "等待 DM 开启歌词";
    document.querySelector(".lyrics-next").textContent = "";
    return;
  }

  state = newState;
  lrcParsed = parseLRC(state.lrcRaw || "") || [];
  isPlaying = state.isPlaying;

  if (userRole === "GM") updateControls(state);

  if (state.isPlaying) {
    cancelAnimationFrame(animFrame);
    startLoop();
  } else {
    cancelAnimationFrame(animFrame);
    renderAt((state.elapsed || 0) / 1000 + (state.offset || 0));
  }
}

function updateControls(s) {
  const btnPlay = document.getElementById("btn-play");
  const btnPause = document.getElementById("btn-pause");
  const btnToggleViz = document.getElementById("btn-toggle-viz");
  if (btnPlay) btnPlay.style.display = s.isPlaying ? "none" : "";
  if (btnPause) btnPause.style.display = s.isPlaying ? "" : "none";
  if (btnToggleViz) btnToggleViz.textContent = s.visible === false ? "👁 显示" : "👁 隐藏";
}

function startLoop() {
  function loop() {
    if (!state || !state.isPlaying) { isPlaying = false; return; }
    const sec = ((state.elapsed || 0) + (Date.now() - state.timestamp)) / 1000 + (state.offset || 0);
    let idx = lrcParsed.findIndex((l) => l.time > sec);
    if (idx === -1) idx = lrcParsed.length;
    renderLyrics(sec, idx);
    animFrame = requestAnimationFrame(loop);
  }
  loop();
}

function renderAt(sec) {
  let idx = lrcParsed.findIndex((l) => l.time > sec);
  if (idx === -1) idx = lrcParsed.length;
  renderLyrics(sec, idx);
}

function renderLyrics(sec, currentIdx) {
  const prevEl = document.querySelector(".lyrics-prev");
  const currEl = document.querySelector(".lyrics-current");
  const nextEl = document.querySelector(".lyrics-next");
  if (!currEl) return;

  const prev = lrcParsed[currentIdx - 2];
  const curr = lrcParsed[currentIdx - 1];
  const next = lrcParsed[currentIdx];

  if (prevEl) prevEl.textContent = prev ? prev.text : "";
  if (nextEl) nextEl.textContent = next ? next.text : "";

  if (curr) {
    const lineDuration = next ? next.time - curr.time : 5;
    const lineElapsed = sec - curr.time;
    const pct = Math.min(Math.max(lineElapsed / lineDuration, 0), 1);

    const chars = Array.from(curr.text);
    const total = chars.length;
    const idx = Math.floor(pct * total);
    const rem = (pct * total) - idx;

    currEl.innerHTML = chars.map((c, i) => {
      let color;
      if (i < idx) color = "#f9a8d4";
      else if (i > idx) color = "#555";
      else color = lerpColor("#555", "#f9a8d4", rem);
      return `<span class="lyrics-char" style="color:${color}">${esc(c)}</span>`;
    }).join("");
  } else {
    currEl.innerHTML = "";
  }
}

function lerpColor(a, b, t) {
  const ah = parseInt(a.slice(1), 16);
  const bh = parseInt(b.slice(1), 16);
  const r1 = (ah >> 16) & 0xff, g1 = (ah >> 8) & 0xff, b1 = ah & 0xff;
  const r2 = (bh >> 16) & 0xff, g2 = (bh >> 8) & 0xff, b2 = bh & 0xff;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
