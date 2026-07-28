import OBR from "@owlbear-rodeo/sdk";
import { getState, onStateChange } from "./sync.js";

const POPOVER_ID = "netease-lyrics-bar";
const POS_NAMESPACE = "com.owlbear-netease-lyrics-pos";

export function mountPL(root) {
  root.innerHTML = `
    <div class="pl-panel">
      <div id="pl-song-info" class="pl-song-info">等待 DM 选择歌曲...</div>
      <div id="pl-lyrics" class="pl-lyrics"></div>
    </div>
  `;

  let state = null;

  OBR.room.onMetadataChange((metadata) => {
    if (metadata[POS_NAMESPACE] && state) {
      repositionLyricsBar(metadata[POS_NAMESPACE]);
    }
  });

  async function handleState(newState) {
    if (!newState || newState.visible === false) {
      state = newState;
      document.getElementById("pl-song-info").textContent = "等待 DM 选择歌曲...";
      document.getElementById("pl-lyrics").innerHTML = "";
      await closeLyricsBar();
      return;
    }
    state = newState;
    document.getElementById("pl-song-info").textContent = `♬ ${newState.songName} — ${newState.artist}`;
    document.getElementById("pl-lyrics").innerHTML = '<p class="pl-lyric-line dimmed" style="padding-top:24px">歌词已浮动显示</p>';
    await openLyricsBar();
  }

  async function openLyricsBar() {
    try {
      const metadata = await OBR.room.getMetadata();
      const savedPos = metadata[POS_NAMESPACE];

      const base = {
        id: POPOVER_ID,
        url: "/obr-lyricsbar/lyrics-bar.html",
        width: 600,
        height: 120,
        hidePaper: true,
        disableClickAway: true,
        marginThreshold: 8,
      };

      if (savedPos && typeof savedPos.x === "number") {
        await OBR.popover.open({
          ...base,
          anchorReference: "POSITION",
          anchorPosition: { left: savedPos.x, top: savedPos.y },
          anchorOrigin: { horizontal: "CENTER", vertical: "TOP" },
          transformOrigin: { horizontal: "CENTER", vertical: "TOP" },
        });
      } else {
        await OBR.popover.open({
          ...base,
          anchorOrigin: { horizontal: "CENTER", vertical: "BOTTOM" },
          transformOrigin: { horizontal: "CENTER", vertical: "BOTTOM" },
        });
      }
    } catch {}
  }

  async function repositionLyricsBar(pos) {
    try { await OBR.popover.close(POPOVER_ID); } catch {}
    try {
      await OBR.popover.open({
        id: POPOVER_ID,
        url: "/obr-lyricsbar/lyrics-bar.html",
        width: 600,
        height: 120,
        hidePaper: true,
        disableClickAway: true,
        marginThreshold: 8,
        anchorReference: "POSITION",
        anchorPosition: { left: pos.x, top: pos.y },
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
