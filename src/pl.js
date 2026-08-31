import OBR from "@owlbear-rodeo/sdk";
import { getState, onStateChange } from "./sync.js";

const POPOVER_ID = "netease-lyrics-bar";
const LYRICS_URL = import.meta.env.DEV ? `${window.location.origin}/lyrics-bar.html` : "/obr-lyricsbar/lyrics-bar.html";

export function mountPL(root) {
  root.innerHTML = `
    <div class="pl-panel">
      <div id="pl-song-info" class="pl-song-info">等待 DM 选择歌曲...</div>
      <div id="pl-lyrics" class="pl-lyrics"></div>
    </div>
  `;

  async function handleState(newState) {
    if (!newState || newState.visible === false) {
      document.getElementById("pl-song-info").textContent = "等待 DM 选择歌曲...";
      document.getElementById("pl-lyrics").innerHTML = "";
      await closeLyricsBar();
      return;
    }
    document.getElementById("pl-song-info").textContent = `♬ ${newState.songName} — ${newState.artist}`;
    document.getElementById("pl-lyrics").innerHTML = '<p class="pl-lyric-line dimmed" style="padding-top:24px">歌词已浮动显示</p>';
    await openLyricsBar();
  }

  async function openLyricsBar() {
    try {
      const left = Math.max((window.innerWidth - 600) / 2, 8);

      await OBR.popover.open({
        id: POPOVER_ID,
        url: LYRICS_URL,
        width: 600,
        height: 120,
        hidePaper: true,
        disableClickAway: true,
        marginThreshold: 8,
        anchorReference: "POSITION",
        anchorPosition: { left, top: 0 },
        anchorOrigin: { horizontal: "CENTER", vertical: "TOP" },
        transformOrigin: { horizontal: "CENTER", vertical: "TOP" },
      });
    } catch {}
  }

  async function closeLyricsBar() {
    try { await OBR.popover.close(POPOVER_ID); } catch {}
  }

  getState().then(handleState);
  onStateChange(handleState);
}