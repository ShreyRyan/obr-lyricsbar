import { parseLRC } from "./lrc.js";

export function setupFileImport(dropZone, callback) {
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add("drag-over");
  });

  dropZone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove("drag-over");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove("drag-over");

    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!file.name.endsWith(".lrc") && !file.name.endsWith(".txt")) {
      callback({ error: "请选择 .lrc 或 .txt 文件" });
      return;
    }
    readFile(file, callback);
  });

  const hiddenInput = document.createElement("input");
  hiddenInput.type = "file";
  hiddenInput.accept = ".lrc,.txt";
  hiddenInput.style.display = "none";
  dropZone.appendChild(hiddenInput);

  dropZone.addEventListener("click", () => hiddenInput.click());

  hiddenInput.addEventListener("change", () => {
    const file = hiddenInput.files[0];
    if (!file) return;
    readFile(file, callback);
    hiddenInput.value = "";
  });
}

function readFile(file, callback) {
  const reader = new FileReader();
  reader.onload = () => {
    const text = reader.result;
    const lrc = parseLRC(text);
    if (lrc.length === 0) {
      callback({ error: "未检测到 LRC 时间戳 [mm:ss.xx]，请确认文件包含标准 LRC 歌词", text });
      return;
    }
    callback({ lrc, text, filename: file.name, source: "file" });
  };
  reader.onerror = () => {
    callback({ error: "文件读取失败" });
  };
  reader.readAsText(file);
}

export function parseTextInput(text) {
  if (!text.trim()) return { error: "请粘贴 LRC 歌词内容" };
  const lrc = parseLRC(text);
  if (lrc.length === 0) {
    return { error: "未检测到 LRC 时间戳 [mm:ss.xx]，请确认内容包含标准 LRC 歌词", text };
  }
  return { lrc, text, source: "paste" };
}
