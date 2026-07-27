import OBR from "@owlbear-rodeo/sdk";
import { getState, onStateChange } from "./sync.js";

let animFrame = null;

const POPOVER_ID = "netease-lyrics-bar";

export function mountPL(root) {
  root.innerHTML = `
    <div class="pl-panel">
      <div id="pl-song-info" class="pl-song-info">等待 DM 选择歌曲...</div>
      <div id="pl-lyrics" class="pl-lyrics"></div>
    </div>
  `;

  let state = null;

  async function handleState(newState) {
    if (!newState) {
      state = null;
      document.getElementById("pl-song-info").textContent = "等待 DM 选择歌曲...";
      document.getElementById("pl-lyrics").innerHTML = "";
      cancelAnimationFrame(animFrame);
      await closeLyricsBar();
      return;
    }
    state = newState;

    if (newState.visible === false) {
      cancelAnimationFrame(animFrame);
      document.getElementById("pl-song-info").textContent = `♬ ${state.songName} — ${state.artist}`;
      document.getElementById("pl-lyrics").innerHTML = '<p class="pl-lyric-line dimmed" style="padding-top:24px">歌词已隐藏</p>';
      await closeLyricsBar();
      return;
    }

    document.getElementById("pl-song-info").textContent = `♬ ${state.songName} — ${state.artist}`;
    document.getElementById("pl-lyrics").innerHTML = '<p class="pl-lyric-line dimmed" style="padding-top:24px">歌词已浮动显示在屏幕顶部</p>';

    await openLyricsBar();

    if (!state.isPlaying) {
      cancelAnimationFrame(animFrame);
    } else {
      startLoop();
    }
  }

  function startLoop() {
    let lastIndex = -1;
    function loop() {
      if (!state || !state.isPlaying) return;
      const sec = (state.elapsed + (Date.now() - state.timestamp)) / 1000 + state.offset;
      const lrc = state.lrc;
      let idx = lrc.findIndex((l) => l.time > sec);
      if (idx === -1) idx = lrc.length;
      if (idx !== lastIndex) {
        lastIndex = idx;
      }
      animFrame = requestAnimationFrame(loop);
    }
    loop();
  }

  async function openLyricsBar() {
    try {
      await OBR.popover.open({
        id: POPOVER_ID,
        url: "/lyrics-bar.html",
        width: 600,
        height: 68,
        hidePaper: true,
        disableClickAway: true,
        anchorOrigin: { horizontal: "CENTER", vertical: "TOP" },
        transformOrigin: { horizontal: "CENTER", vertical: "TOP" },
        marginThreshold: 10,
      });
    } catch {
      // popover might already be open
    }
  }

  async function closeLyricsBar() {
    try {
      await OBR.popover.close(POPOVER_ID);
    } catch {
      // popover might not be open
    }
  }

  getState().then(handleState);
  onStateChange(handleState);
}
