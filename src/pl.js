import { openLyricsBar, closeLyricsBar } from "./shared.js";
import { getState, onStateChange } from "./sync.js";

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

  getState().then(handleState);
  onStateChange(handleState);
}