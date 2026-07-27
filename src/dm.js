import { setupFileImport, parseTextInput } from "./import.js";
import { setState } from "./sync.js";

let selectedSong = null;
let lrcData = [];
let currentState = { elapsed: 0, isPlaying: false, offset: 0, timestamp: 0 };
let previewTimer = null;
let latestOffset = 0;
let isVisible = true;

export function mountDM(root) {
  root.innerHTML = `
    <div class="dm-panel">
      <h2>🎵 歌词同步</h2>

      <div class="song-info-inputs">
        <input type="text" id="song-name" placeholder="歌曲名（选填，PL 端显示用）" />
        <input type="text" id="song-artist" placeholder="歌手名（选填，PL 端显示用）" />
      </div>

      <div id="import-status" class="import-status empty">
        <span>未导入歌词</span>
      </div>

      <div class="import-section">
        <div class="import-divider"><span>拖拽或选择文件</span></div>
        <div id="drop-zone" class="drop-zone">
          <div class="drop-zone-content">
            <span class="drop-icon">📁</span>
            <span>拖拽 .lrc 文件到此处</span>
            <span class="drop-hint">或点击选择文件</span>
          </div>
        </div>
        <div class="import-divider"><span>或直接粘贴</span></div>
        <textarea id="paste-area" class="paste-area" placeholder="粘贴 LRC 歌词内容...&#10;&#10;示例格式：&#10;[00:13.10]第一句歌词&#10;[00:17.25]第二句歌词" rows="6"></textarea>
        <button id="btn-parse-paste" class="btn-parse">解析歌词</button>
      </div>

      <div class="controls">
        <button id="btn-play" disabled>▶ 开始</button>
        <button id="btn-pause" class="hidden">⏸ 暂停</button>
        <button id="btn-resume" class="hidden">▶ 继续</button>
        <button id="btn-toggle-visibility" class="hidden">👁‍ 隐藏</button>
      </div>

      <div class="offset-controls">
        <button id="btn-offset-minus" disabled>-0.5s</button>
        <span id="offset-display" class="offset-display">偏移: 0.0s</span>
        <button id="btn-offset-plus" disabled>+0.5s</button>
      </div>

      <div class="lyrics-preview" id="lyrics-preview">
        <p class="lyrics-placeholder">导入歌词后此处预览</p>
      </div>
    </div>
  `;

  bindEvents(root);
}

function bindEvents(root) {
  const dropZone = root.querySelector("#drop-zone");
  const pasteArea = root.querySelector("#paste-area");
  const btnParsePaste = root.querySelector("#btn-parse-paste");
  const importStatus = root.querySelector("#import-status");
  const lyricsPreview = root.querySelector("#lyrics-preview");

  const btnPlay = root.querySelector("#btn-play");
  const btnPause = root.querySelector("#btn-pause");
  const btnResume = root.querySelector("#btn-resume");
  const btnToggle = root.querySelector("#btn-toggle-visibility");
  const btnOffsetMinus = root.querySelector("#btn-offset-minus");
  const btnOffsetPlus = root.querySelector("#btn-offset-plus");
  const offsetDisplay = root.querySelector("#offset-display");

  const songNameInput = root.querySelector("#song-name");
  const songArtistInput = root.querySelector("#song-artist");

  function onImportResult(result) {
    if (result.error) {
      importStatus.classList.add("error");
      importStatus.classList.remove("success");
      importStatus.innerHTML = `<span>❌ ${esc(result.error)}</span>`;
      return;
    }
    lrcData = result.lrc;
    importStatus.classList.remove("error");
    importStatus.classList.add("success");

    const name = songNameInput.value.trim() || "未知歌曲";
    const artist = songArtistInput.value.trim() || "未知歌手";
    selectedSong = { name, artist };
    importStatus.innerHTML = `<span>✅ 已解析 ${lrcData.length} 句歌词 — ${esc(name)} / ${esc(artist)}</span>`;

    btnPlay.disabled = false;
    renderPreview(0);
  }

  setupFileImport(dropZone, onImportResult);

  btnParsePaste.addEventListener("click", () => {
    const result = parseTextInput(pasteArea.value);
    onImportResult(result);
  });

  pasteArea.addEventListener("input", () => {
    btnParsePaste.disabled = !pasteArea.value.trim();
  });
  btnParsePaste.disabled = true;

  btnPlay.addEventListener("click", () => startLyrics(btnPlay, btnPause, btnResume, btnOffsetMinus, btnOffsetPlus));
  btnPause.addEventListener("click", () => pauseLyrics(btnPlay, btnPause, btnResume));
  btnResume.addEventListener("click", () => resumeLyrics(btnPlay, btnPause, btnResume));
  btnToggle.addEventListener("click", toggleVisibility);
  btnOffsetMinus.addEventListener("click", () => shiftOffset(-0.5, offsetDisplay));
  btnOffsetPlus.addEventListener("click", () => shiftOffset(0.5, offsetDisplay));
}

async function startLyrics(btnPlay, btnPause, btnResume, btnToggle, btnOffsetMinus, btnOffsetPlus) {
  btnPlay.classList.add("hidden");
  btnPause.classList.remove("hidden");
  btnResume.classList.add("hidden");
  btnToggle.classList.remove("hidden");
  btnToggle.textContent = "👁‍ 隐藏";
  btnOffsetMinus.disabled = false;
  btnOffsetPlus.disabled = false;
  latestOffset = 0;
  isVisible = true;

  currentState = { elapsed: 0, isPlaying: true, offset: 0, timestamp: Date.now() };
  startPreviewLoop();
  await pushState();
}

async function pauseLyrics(btnPlay, btnPause, btnResume) {
  btnPause.classList.add("hidden");
  btnResume.classList.remove("hidden");
  stopPreviewLoop();
  currentState.elapsed = computeElapsed();
  currentState.isPlaying = false;
  currentState.timestamp = Date.now();
  await pushState();
}

async function resumeLyrics(btnPlay, btnPause, btnResume) {
  btnResume.classList.add("hidden");
  btnPause.classList.remove("hidden");
  currentState.isPlaying = true;
  currentState.timestamp = Date.now();
  startPreviewLoop();
  await pushState();
}

async function toggleVisibility() {
  isVisible = !isVisible;
  const btn = document.getElementById("btn-toggle-visibility");
  if (btn) {
    btn.textContent = isVisible ? "👁‍ 隐藏" : "👁 显示";
  }
  await pushState();
}

async function shiftOffset(delta, offsetDisplay) {
  latestOffset += delta;
  currentState.elapsed = computeElapsed();
  currentState.offset = latestOffset;
  currentState.timestamp = Date.now();
  offsetDisplay.textContent = `偏移: ${latestOffset.toFixed(1)}s`;
  await pushState();
}

function computeElapsed() {
  if (!currentState.isPlaying) return currentState.elapsed;
  return currentState.elapsed + (Date.now() - currentState.timestamp);
}

async function pushState() {
  await setState({
    songId: selectedSong?.name || "",
    songName: selectedSong?.name || "",
    artist: selectedSong?.artist || "",
    lrc: lrcData,
    elapsed: computeElapsed(),
    isPlaying: currentState.isPlaying,
    offset: latestOffset,
    timestamp: Date.now(),
    visible: isVisible
  });
}

function startPreviewLoop() {
  clearInterval(previewTimer);
  let lastIdx = -1;
  previewTimer = setInterval(() => {
    const sec = computeElapsed() / 1000 + latestOffset;
    let idx = lrcData.findIndex(l => l.time > sec);
    if (idx === -1) idx = lrcData.length;
    if (idx !== lastIdx) { lastIdx = idx; renderPreview(idx); }
  }, 150);
}

function stopPreviewLoop() {
  clearInterval(previewTimer);
  previewTimer = null;
}

function renderPreview(currentIdx) {
  const container = document.getElementById("lyrics-preview");
  if (!container) return;
  const rows = [
    lrcData[currentIdx - 2],
    lrcData[currentIdx - 1],
    lrcData[currentIdx],
    lrcData[currentIdx + 1],
    lrcData[currentIdx + 2],
  ];
  container.innerHTML = rows.map((l, i) => {
    if (!l) return '<p class="lyric-line empty-line"></p>';
    return `<p class="lyric-line ${i === 2 ? "current" : "dimmed"}">${esc(l.text) || ""}</p>`;
  }).join("");
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
