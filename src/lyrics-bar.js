import OBR from "@owlbear-rodeo/sdk";
import { getState, onStateChange, setState, liveElapsed } from "./sync.js";
import { POPOVER_ID, BAR_HEIGHT, BAR_HEIGHT_GROUPED, esc } from "./shared.js";
import { parseLRC } from "./lrc.js";

const LOCK_KEY = "netease-lyrics-locked";

let state = null;
let lrcParsed = [];
let animFrame = null;
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

function play(){
  if (state) updateState({ isPlaying: true });
}

function pause(){
  if (state) updateState({ isPlaying: false });
}

function stop(){
  if (!state) return; offsetRef = 0;
  updateState({ elapsed: 0, isPlaying: false, offset: 0, visible: true });
}

function toggleViz(){
  if (state) updateState({ visible: state.visible === false, isPlaying: false });
}

let shiftTimer = null;
let heartbeatTimer = null;

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (userRole !== "GM" || !state || !state.isPlaying) return;
    updateState({});   // 复用统一入口：带最新 elapsed/offsetRef，走 N4 队列
  }, 5000);
}

function stopHeartbeat() {
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

function shift(delta) {
  if (!state) return;
  offsetRef += delta;
  clearTimeout(shiftTimer);
  shiftTimer = setTimeout(() => updateState({}), 120);
}

async function updateState(patch) {
  if (!state) return;
  clearTimeout(shiftTimer);
  const next = {
    songId: state.songId,
    songName: state.songName,
    artist: state.artist,
    lrcRaw: state.lrcRaw,
    elapsed: patch.elapsed !== undefined ? patch.elapsed : liveElapsed(state),
    isPlaying: patch.isPlaying !== undefined ? patch.isPlaying : state.isPlaying,
    offset: patch.offset !== undefined ? patch.offset : offsetRef,
    timestamp: Date.now(),
    visible: patch.visible !== undefined ? patch.visible : state.visible !== false,
  };
  handleState(next);                 // ① 本地先行：立即渲染/启停循环
  if (next.visible === false) {
    try { await OBR.popover.close(POPOVER_ID); } catch {}   // ② 隐藏就关条（本地先关，与网络无关）
  }
  await setState(next);
}

function handleState(newState) {
  if (!newState) {
    state = null;
    lrcParsed = [];
    cancelAnimationFrame(animFrame);
    document.querySelector(".lyrics-prev").textContent = "";
    document.querySelector(".lyrics-current").textContent = "等待 DM 开启歌词";
    document.querySelector(".lyrics-next").textContent = "";
    resetHeight();
    return;
  }

  if (state && state.isPlaying) {
    const localPos = liveElapsed(state);
    const remotePos = liveElapsed(newState);
    if (remotePos < localPos - 700) return;
  }

  state = newState;
  lrcParsed = parseLRC(state.lrcRaw || "") || [];
  offsetRef = state.offset || 0;

  if (newState.visible === false) {
    cancelAnimationFrame(animFrame);
    document.querySelector(".lyrics-prev").textContent = "";
    document.querySelector(".lyrics-current").textContent = "";
    document.querySelector(".lyrics-next").textContent = "";
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
  for (const seg of segments) {
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
  const target = segments.length > 1 ? BAR_HEIGHT_GROUPED : BAR_HEIGHT;
  if (currEl.__h !== target) {
    currEl.__h = target;
    try { OBR.popover.setHeight(POPOVER_ID, target); } catch {}
  }
}

function resetHeight() {
  const el = document.querySelector(".lyrics-current");
  if (el && el.__h !== BAR_HEIGHT) {
    el.__h = BAR_HEIGHT;
    try { OBR.popover.setHeight(POPOVER_ID, BAR_HEIGHT); } catch {}
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
