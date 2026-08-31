import OBR from "@owlbear-rodeo/sdk";

const NAMESPACE = "com.owlbear-netease-lyrics";

export async function getState() {
  const metadata = await OBR.room.getMetadata();
  return metadata[NAMESPACE] || null;
}

let inFlight = false;
let pending = null;

export async function setState(state) {
  pending = state;                  // 最新待写（覆盖旧的中间态）
  if (inFlight) return;             // 已有写入在途：排队，由在途循环稍后发出
  inFlight = true;
  try {
    while (pending) {
      const target = pending;
      pending = null;
      try {
        await OBR.room.setMetadata({ [NAMESPACE]: target });
      } catch (e) {
        console.warn("歌词状态同步失败，请检查网络", e);
        break;                      // 失败放弃本轮；下一次调用会带最新状态重试
      }
    }
  } finally {
    inFlight = false;
  }
}

export function onStateChange(callback) {
  let last = Symbol();
  OBR.room.onMetadataChange((metadata) => {
    const state = metadata[NAMESPACE];
    if (!Object.is(state, last)) {
      last = state;
      callback(state);
    }
  });
}

// 计算某个状态的实时播放位置（毫秒）
export function liveElapsed(s) {
  return (s.elapsed || 0) + (s.isPlaying ? Date.now() - s.timestamp : 0);
}