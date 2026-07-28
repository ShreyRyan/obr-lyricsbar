import OBR from "@owlbear-rodeo/sdk";
import { getState, onStateChange } from "./sync.js";
import { parseLRC } from "./lrc.js";

const POS_NAMESPACE = "com.owlbear-netease-lyrics-pos";

let state = null;
let animFrame = null;
let lrcParsed = [];
let dragStartX = 0;
let dragStartY = 0;
let isDragging = false;

OBR.onReady(async () => {
  const initial = await getState();
  handleState(initial);
  onStateChange(handleState);

  const handle = document.getElementById("lyrics-bar-handle");
  if (!handle) return;

  handle.addEventListener("mousedown", onDragStart);
  handle.addEventListener("touchstart", onDragStart, { passive: false });
  window.addEventListener("mousemove", onDragMove);
  window.addEventListener("touchmove", onDragMove, { passive: false });
  window.addEventListener("mouseup", onDragEnd);
  window.addEventListener("touchend", onDragEnd);
});

function onDragStart(e) {
  isDragging = true;
  const pt = e.touches ? e.touches[0] : e;
  dragStartX = pt.clientX;
  dragStartY = pt.clientY;
  document.body.style.cursor = "grabbing";
}

function onDragMove(e) {
  if (!isDragging) return;
  const pt = e.touches ? e.touches[0] : e;
  const dx = pt.clientX - dragStartX;
  const dy = pt.clientY - dragStartY;
  const bar = document.getElementById("lyrics-bar");
  if (bar) {
    bar.style.transform = `translate(${dx}px, ${dy}px)`;
  }
}

async function onDragEnd(e) {
  if (!isDragging) return;
  isDragging = false;
  document.body.style.cursor = "";

  const pt = e.changedTouches ? e.changedTouches[0] : e;
  const bar = document.getElementById("lyrics-bar");
  if (!bar) return;

  bar.style.transform = "";

  const rect = bar.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  try {
    await OBR.room.setMetadata({ [POS_NAMESPACE]: { x: Math.round(centerX), y: Math.round(centerY) } });
  } catch {}
}

function handleState(newState) {
  if (!newState || newState.visible === false) {
    state = null;
    lrcParsed = [];
    cancelAnimationFrame(animFrame);
    document.getElementById("lyrics-bar-text").textContent = "";
    return;
  }
  state = newState;
  lrcParsed = parseLRC(state.lrcRaw || "") || [];

  if (state.isPlaying) {
    startLoop();
  } else {
    cancelAnimationFrame(animFrame);
    renderAt(state.elapsed / 1000 + state.offset);
  }
}

function startLoop() {
  let lastIndex = -1;
  function loop() {
    if (!state || !state.isPlaying) return;
    const sec =
      (state.elapsed + (Date.now() - state.timestamp)) / 1000 + state.offset;
    let idx = lrcParsed.findIndex((l) => l.time > sec);
    if (idx === -1) idx = lrcParsed.length;
    if (idx !== lastIndex) {
      lastIndex = idx;
      displayLine(idx);
    }
    animFrame = requestAnimationFrame(loop);
  }
  loop();
}

function renderAt(sec) {
  let idx = lrcParsed.findIndex((l) => l.time > sec);
  if (idx === -1) idx = lrcParsed.length;
  displayLine(idx);
}

function displayLine(currentIndex) {
  const el = document.getElementById("lyrics-bar-text");
  if (!el) return;
  const line = lrcParsed[currentIndex - 1];
  el.textContent = line ? line.text : "";
}
