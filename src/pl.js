import { getState, onStateChange } from "./sync.js";
import { openLyricsBar, closeLyricsBar } from "./shared.js";

export function mountPL(root) {
  root.innerHTML = `
    <div class="pl-panel">
      <button id="btn-pl-viz" class="pl-viz-btn">👁 隐藏歌词</button>
    </div>
  `;

  let barHidden = false;   // 本 PL 的本地偏好：悬浮条是否被自己隐藏
  let hasLyrics = false;   // DM 是否正在显示歌词
  const btn = root.querySelector("#btn-pl-viz");

  function refreshBtn() {
    btn.disabled = !hasLyrics;
    btn.textContent = barHidden ? "👁 显示歌词" : "👁 隐藏歌词";
  }

  btn.addEventListener("click", async () => {
    if (barHidden) {
      await openLyricsBar();
      barHidden = false;
    } else {
      await closeLyricsBar();
      barHidden = true;
    }
    refreshBtn();
  });

  async function handleState(newState) {
    if (!newState || newState.visible === false) {
      // DM 隐藏/未开启：关条并复位本地偏好（DM 的隐藏优先级更高）
      await closeLyricsBar();
      barHidden = false;
      hasLyrics = false;
      refreshBtn();
      return;
    }
    hasLyrics = true;
    if (!barHidden) {
      await openLyricsBar();   // 尊重本地偏好：PL 自己隐藏过就不强制弹回
    }
    refreshBtn();
  }

  getState().then(handleState);
  onStateChange(handleState);
}