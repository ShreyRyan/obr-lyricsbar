import OBR from "@owlbear-rodeo/sdk";
import { readFile, parseTextInput } from "./import.js";
import { setState } from "./sync.js";

const POPOVER_ID = "netease-lyrics-bar";

let selectedSong = null;
let lrcData = [];
let lrcRaw = "";
let lyricsActive = false;

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
        <div class="import-file-row">
          <button id="btn-select-file" class="btn-file">📁 选择 .lrc 文件</button>
          <span id="file-name" class="file-name"></span>
        </div>
        <div class="import-divider"><span>或直接粘贴</span></div>
        <textarea id="paste-area" class="paste-area" placeholder="粘贴 LRC 歌词内容...&#10;&#10;示例格式：&#10;[00:13.10]第一句歌词&#10;[00:17.25]第二句歌词" rows="6"></textarea>
        <button id="btn-parse-paste" class="btn-parse">解析歌词</button>
      </div>

      <div class="controls">
        <button id="btn-toggle-lyrics" disabled>📢 开启歌词</button>
      </div>

      <div class="lyrics-preview" id="lyrics-preview">
        <p class="lyrics-placeholder">导入歌词后此处预览</p>
      </div>
    </div>
  `;

  bindEvents(root);
}

function bindEvents(root) {
  const pasteArea = root.querySelector("#paste-area");
  const btnParsePaste = root.querySelector("#btn-parse-paste");
  const importStatus = root.querySelector("#import-status");
  const btnSelectFile = root.querySelector("#btn-select-file");
  const fileNameDisplay = root.querySelector("#file-name");
  const btnToggleLyrics = root.querySelector("#btn-toggle-lyrics");

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
    lrcRaw = result.text;
    importStatus.classList.remove("error");
    importStatus.classList.add("success");

    const name = songNameInput.value.trim() || "未知歌曲";
    const artist = songArtistInput.value.trim() || "未知歌手";
    selectedSong = { name, artist };
    importStatus.innerHTML = `<span>✅ 已解析 ${lrcData.length} 句歌词 — ${esc(name)} / ${esc(artist)}</span>`;

    btnToggleLyrics.disabled = false;
    renderPreview(0);
  }

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".lrc,.txt";
  fileInput.style.display = "none";
  root.appendChild(fileInput);

  btnSelectFile.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    fileNameDisplay.textContent = file.name;
    readFile(file, onImportResult);
    fileInput.value = "";
  });

  btnParsePaste.addEventListener("click", () => {
    const result = parseTextInput(pasteArea.value);
    onImportResult(result);
  });

  pasteArea.addEventListener("input", () => {
    btnParsePaste.disabled = !pasteArea.value.trim();
  });
  btnParsePaste.disabled = true;

  btnToggleLyrics.addEventListener("click", async () => {
    if (!lyricsActive) {
      await setState({
        songId: selectedSong.name,
        songName: selectedSong.name,
        artist: selectedSong.artist,
        lrcRaw,
        elapsed: 0,
        isPlaying: false,
        offset: 0,
        timestamp: Date.now(),
        visible: true,
      });

      try {
        await OBR.popover.open({
          id: POPOVER_ID,
          url: "/obr-lyricsbar/lyrics-bar.html",
          width: 600,
          height: 120,
          hidePaper: true,
          disableClickAway: true,
          anchorOrigin: { horizontal: "CENTER", vertical: "BOTTOM" },
          transformOrigin: { horizontal: "CENTER", vertical: "BOTTOM" },
          marginThreshold: 8,
        });
      } catch {}

      lyricsActive = true;
      btnToggleLyrics.textContent = "📢 关闭歌词";
    } else {
      await setState(null);
      try { await OBR.popover.close(POPOVER_ID); } catch {}
      lyricsActive = false;
      btnToggleLyrics.textContent = "📢 开启歌词";
    }
  });
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
  container.innerHTML = rows
    .map((l, i) => {
      if (!l) return '<p class="lyric-line empty-line"></p>';
      return `<p class="lyric-line ${i === 2 ? "current" : "dimmed"}">${esc(l.text) || ""}</p>`;
    })
    .join("");
}

function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
