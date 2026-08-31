import { parseLRC } from "./lrc.js";

export function readFile(file, callback) {
  const reader = new FileReader();
  reader.onload = () => {
    const text = reader.result;
    const lrc = parseLRC(text);
    if (lrc.length === 0) {
      callback({ error: "未检测到 LRC 时间戳 [mm:ss.xx]，请确认文件包含标准 LRC 歌词", text });
      return;
    }
    callback({ lrc, text });
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
  return { lrc, text };
}
