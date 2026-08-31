const LINE_RE = /^\[(\d{2}):(\d{2})[\.:](\d{2,3})\]/;
const OFFSET_RE = /\[offset:([+-]?\d+)\]/g;

export function parseLRC(lrcText) {
  if (!lrcText) return [];

  const lines = lrcText.split("\n");
  const result = [];
  let offsetSec = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Apply any [offset:±ms] tags (accumulate; affects subsequent timestamps)
    let m;
    OFFSET_RE.lastIndex = 0;
    while ((m = OFFSET_RE.exec(trimmed)) !== null) {
      offsetSec += parseInt(m[1], 10) / 1000;
    }

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
      lastIdx += match[0].length;
    }

    for (const time of tags) {
      result.push({ time: time + offsetSec, text });
    }
  }

  result.sort((a, b) => a.time - b.time);
  return result;
}
