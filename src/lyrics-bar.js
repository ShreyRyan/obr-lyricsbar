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
let offsetRef = 0;

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
  clearTimeout(shiftTimer);
  await setState({
    songId: state.songId, songName: state.songName, artist: state.artist,
    lrcRaw: state.lrcRaw, elapsed: state.elapsed || 0, isPlaying: true,
    offset: offsetRef, timestamp: Date.now(), visible: state.visible !== false,
  });
}

async function pause() {
  if (!state) return;
  clearTimeout(shiftTimer);
  const elapsed = (state.elapsed || 0) + (state.isPlaying ? Date.now() - state.timestamp : 0);
  await setState({
    songId: state.songId, songName: state.songName, artist: state.artist,
    lrcRaw: state.lrcRaw, elapsed, isPlaying: false,
    offset: offsetRef, timestamp: Date.now(), visible: state.visible !== false,
  });
}

async function stop() {
  if (!state) return;
  clearTimeout(shiftTimer);
  offsetRef = 0;
  await setState({
    songId: state.songId, songName: state.songName, artist: state.artist,
    lrcRaw: state.lrcRaw, elapsed: 0, isPlaying: false,
    offset: 0, timestamp: Date.now(), visible: true,
  });
}

async function toggleViz() {
  if (!state) return;
  clearTimeout(shiftTimer);
  const newVis = state.visible === false;
  await setState({
    songId: state.songId, songName: state.songName, artist: state.artist,
    lrcRaw: state.lrcRaw, elapsed: state.elapsed || 0, isPlaying: state.isPlaying || false,
    offset: offsetRef, timestamp: Date.now(), visible: newVis,
  });
}

let shiftTimer = null;

async function shift(delta) {
  if (!state) return;
  // Apply immediately to the local authoritative offset
  offsetRef += delta;

  // Coalesce rapid clicks into a single trailing write
  clearTimeout(shiftTimer);
  shiftTimer = setTimeout(async () => {
    if (!state) return;
    const elapsed = (state.elapsed || 0) + (state.isPlaying ? Date.now() - state.timestamp : 0);
    await setState({
      songId: state.songId, songName: state.songName, artist: state.artist,
      lrcRaw: state.lrcRaw, elapsed, isPlaying: state.isPlaying || false,
      offset: offsetRef, timestamp: Date.now(), visible: state.visible !== false,
    });
  }, 120);
}

function handleState(newState) {
  if (!newState) {
    state = null; lrcParsed = [];
    cancelAnimationFrame(animFrame);
    document.querySelector(".lyrics-prev").textContent = "";
    document.querySelector(".lyrics-current").textContent = "等待 DM 开启歌词";
    document.querySelector(".lyrics-next").textContent = "";
    resetHeight();
    return;
  }

  state = newState;
  lrcParsed = parseLRC(state.lrcRaw || "") || [];
  isPlaying = state.isPlaying;
  offsetRef = state.offset || 0;

  if (newState.visible === false) {
    cancelAnimationFrame(animFrame);
    document.querySelector(".lyrics-prev").textContent = "";
    document.querySelector(".lyrics-current").textContent = "歌词已隐藏";
    document.querySelector(".lyrics-next").textContent = "";
    if (userRole === "GM") updateControls(state);
    resetHeight();
    return;
  }

  if (userRole === "GM") updateControls(state);

  if (state.isPlaying) {
    cancelAnimationFrame(animFrame);
    startLoop();
  } else {
    cancelAnimationFrame(animFrame);
    renderAt((state.elapsed || 0) / 1000 + offsetRef);
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
    const sec = ((state.elapsed || 0) + (Date.now() - state.timestamp)) / 1000 + offsetRef;
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

  // Determine the active group: all entries sharing the same timestamp
  const activeTime = lrcParsed[currentIdx - 1]?.time;
  if (activeTime === undefined) {
    if (prevEl) prevEl.textContent = "";
    if (nextEl) nextEl.textContent = "";
    currEl.innerHTML = "";
    return;
  }

  let gs = currentIdx - 1;
  while (gs > 0 && lrcParsed[gs - 1].time === activeTime) gs--;
  let ge = currentIdx - 1;
  while (ge + 1 < lrcParsed.length && lrcParsed[ge + 1].time === activeTime) ge++;

  const group = lrcParsed.slice(gs, ge + 1);
  const prev = lrcParsed[gs - 1];
  const next = lrcParsed[ge + 1];  // time > activeTime (or undefined)

  if (prevEl) prevEl.textContent = prev ? prev.text : "";
  if (nextEl) nextEl.textContent = next ? next.text : "";

  // Split group into per-line char segments (e.g. zh line + en line)
  const segments = group.map((e) => Array.from(e.text || ""));

  // Flatten for continuous cross-line coloring
  let flat = [];
  let lineOffsets = [];
  for (const seg of segments) {
    lineOffsets.push(flat.length);
    flat.push(...seg);
  }
  const total = flat.length;

  // Rebuild DOM only when the active group changes
  const key = segments.map((s) => s.join("")).join("\n");
  if (currEl.dataset.line !== key) {
    currEl.dataset.line = key;
    currEl.innerHTML = segments
      .map(
        (seg) =>
          `<span class="lyrics-current-line">${seg
            .map((c) => `<span class="lyrics-char">${esc(c)}</span>`)
            .join("")}</span>`
      )
      .join("");
  }

  // Duration to the next DISTINCT time (always > 0)
  const lineDuration = next ? next.time - activeTime : 5;
  const lineElapsed = sec - activeTime;
  const pct = Math.min(Math.max(lineElapsed / lineDuration, 0), 1);
  const idx = Math.floor(pct * total);
  const rem = (pct * total) - idx;

  // Color every char span in flat order (continuous across lines)
  const allSpans = currEl.querySelectorAll(".lyrics-char");
  for (let i = 0; i < allSpans.length; i++) {
    if (i < idx) allSpans[i].style.color = "#f9a8d4";
    else if (i > idx) allSpans[i].style.color = "#555";
    else allSpans[i].style.color = lerpColor("#555", "#f9a8d4", rem);
  }

  // Dynamic height: taller when showing two lines
  const target = segments.length > 1 ? 150 : 120;
  if (currEl.__h !== target) {
    currEl.__h = target;
    try { OBR.popover.setHeight("netease-lyrics-bar", target); } catch {}
  }
}

function resetHeight() {
  const el = document.querySelector(".lyrics-current");
  if (el && el.__h !== 120) {
    el.__h = 120;
    try { OBR.popover.setHeight("netease-lyrics-bar", 120); } catch {}
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
