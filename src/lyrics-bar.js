import OBR from "@owlbear-rodeo/sdk";
import { getState, onStateChange, setState } from "./sync.js";
import { parseLRC } from "./lrc.js";

const POS_NAMESPACE = "com.owlbear-netease-lyrics-pos";

let state = null;
let lrcParsed = [];
let animFrame = null;
let isPlaying = false;
let dragStartX = 0, dragStartY = 0, isDragging = false;

OBR.onReady(async () => {
  const role = await OBR.player.getRole();
  if (role !== "GM") {
    const row = document.getElementById("controls-row");
    if (row) row.classList.add("hidden");
  }

  const initial = await getState();
  handleState(initial);
  onStateChange(handleState);

  bindDrag();
  bindControls();
});

function bindDrag() {
  const handle = document.getElementById("lyrics-bar-handle");
  if (!handle) return;
  handle.addEventListener("mousedown", (e) => { isDragging = true; dragStartX = e.clientX; dragStartY = e.clientY; document.body.style.cursor = "grabbing"; });
  handle.addEventListener("touchstart", (e) => { isDragging = true; const t = e.touches[0]; dragStartX = t.clientX; dragStartY = t.clientY; document.body.style.cursor = "grabbing"; }, { passive: false });
  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const bar = document.getElementById("lyrics-bar");
    if (bar) bar.style.transform = `translate(${e.clientX - dragStartX}px, ${e.clientY - dragStartY}px)`;
  });
  window.addEventListener("touchmove", (e) => {
    if (!isDragging) return;
    const t = e.touches[0];
    const bar = document.getElementById("lyrics-bar");
    if (bar) bar.style.transform = `translate(${t.clientX - dragStartX}px, ${t.clientY - dragStartY}px)`;
  }, { passive: false });
  window.addEventListener("mouseup", onDragEnd);
  window.addEventListener("touchend", onDragEnd);
}

async function onDragEnd(e) {
  if (!isDragging) return;
  isDragging = false; document.body.style.cursor = "";
  const pt = e.changedTouches ? e.changedTouches[0] : e;
  const bar = document.getElementById("lyrics-bar");
  if (!bar) return;
  bar.style.transform = "";
  const rect = bar.getBoundingClientRect();
  try {
    await OBR.room.setMetadata({ [POS_NAMESPACE]: { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) } });
  } catch {}
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
    document.querySelector(".progress-fill").style.width = "0%";
    document.querySelector(".progress-time").textContent = "00:00 / 00:00";
    return;
  }

  state = newState;
  lrcParsed = parseLRC(state.lrcRaw || "") || [];
  isPlaying = state.isPlaying;

  updateControls(state);
  updateProgress();

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
  let lastIndex = -1;
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
    const pct = Math.min(Math.max(lineElapsed / lineDuration, 0), 1) * 100;

    currEl.textContent = curr.text;
    currEl.style.background = `linear-gradient(to right, #f9a8d4 ${pct}%, #666 ${pct}%)`;
    currEl.style.color = "transparent";
  } else {
    currEl.textContent = "";
  }

  updateProgress();
}

function updateProgress() {
  if (!state || !lrcParsed.length) return;
  const total = lrcParsed[lrcParsed.length - 1]?.time || 0;
  const sec = isPlaying
    ? ((state.elapsed || 0) + (Date.now() - state.timestamp)) / 1000 + (state.offset || 0)
    : (state.elapsed || 0) / 1000 + (state.offset || 0);
  const pct = total > 0 ? Math.min(Math.max(sec / total, 0), 1) * 100 : 0;

  const fill = document.querySelector(".progress-fill");
  if (fill) fill.style.width = `${pct}%`;

  const timeEl = document.querySelector(".progress-time");
  if (timeEl) timeEl.textContent = `${fmt(sec)} / ${fmt(total)}`;
}

function fmt(sec) {
  const m = Math.floor(Math.max(sec, 0) / 60);
  const s = Math.floor(Math.max(sec, 0) % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
