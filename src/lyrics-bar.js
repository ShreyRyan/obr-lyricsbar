import OBR from "@owlbear-rodeo/sdk";
import { getState, onStateChange } from "./sync.js";

let state = null;
let animFrame = null;

OBR.onReady(async () => {
  const initial = await getState();
  handleState(initial);
  onStateChange(handleState);
});

function handleState(newState) {
  if (!newState || newState.visible === false) {
    state = null;
    cancelAnimationFrame(animFrame);
    document.getElementById("lyrics-bar-text").textContent = "";
    return;
  }
  state = newState;

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
    const lrc = state.lrc;
    let idx = lrc.findIndex((l) => l.time > sec);
    if (idx === -1) idx = lrc.length;
    if (idx !== lastIndex) {
      lastIndex = idx;
      displayLine(lrc, idx);
    }
    animFrame = requestAnimationFrame(loop);
  }
  loop();
}

function renderAt(sec) {
  if (!state) return;
  const lrc = state.lrc;
  let idx = lrc.findIndex((l) => l.time > sec);
  if (idx === -1) idx = lrc.length;
  displayLine(lrc, idx);
}

function displayLine(lrc, currentIndex) {
  const el = document.getElementById("lyrics-bar-text");
  if (!el) return;
  const line = lrc[currentIndex - 1];
  el.textContent = line ? line.text : "";
}
