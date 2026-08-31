// src/shared.js —— 跨文件公共代码
import OBR from "@owlbear-rodeo/sdk";

export const POPOVER_ID = "netease-lyrics-bar";

export const LYRICS_URL = import.meta.env.DEV
    ? `${window.location.origin}/lyrics-bar.html`
    : "/obr-lyricsbar/lyrics-bar.html";

export const BAR_WIDTH = 600;
export const BAR_HEIGHT = 120;
export const BAR_HEIGHT_GROUPED = 150; // 双语两行时的高度

export function computeBarLeft() {
    return Math.max((window.innerWidth - BAR_WIDTH) / 2, 8);
}

// 打开歌词条（吞掉错误，与现行为一致）
export async function openLyricsBar() {
    try {
        await OBR.popover.open({
            id: POPOVER_ID,
            url: LYRICS_URL,
            width: BAR_WIDTH,
            height: BAR_HEIGHT,
            hidePaper: true,
            disableClickAway: true,
            marginThreshold: 8,
            anchorReference: "POSITION",
            anchorPosition: { left: computeBarLeft(), top: 0 },
            anchorOrigin: { horizontal: "CENTER", vertical: "TOP" },
            transformOrigin: { horizontal: "CENTER", vertical: "TOP" },
        });
    } catch {}
}

export async function closeLyricsBar() {
    try { await OBR.popover.close(POPOVER_ID); } catch {}
}

export function esc(s) {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}