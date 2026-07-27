const LINE_RE = /^\[(\d{2}):(\d{2})[\.:](\d{2,3})\](.*)$/;

export function parseLRC(lrcText) {
  if (!lrcText) return [];

  const lines = lrcText.split("\n");
  const result = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const tags = [];
    let text = "";
    let lastIdx = 0;

    while (lastIdx < trimmed.length) {
      const sub = trimmed.slice(lastIdx);
      const match = sub.match(LINE_RE);
      if (!match) {
        text = sub;
        break;
      }
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const msRaw = match[3];
      const ms = msRaw.length === 2 ? parseInt(msRaw, 10) * 10 : parseInt(msRaw, 10);
      tags.push(min * 60 + sec + ms / 1000);
      text = match[4].trim();
      lastIdx += match[0].length;
    }

    for (const time of tags) {
      result.push({ time, text });
    }
  }

  result.sort((a, b) => a.time - b.time);
  return result;
}
