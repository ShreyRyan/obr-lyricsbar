import OBR from "@owlbear-rodeo/sdk";

const NAMESPACE = "com.owlbear-netease-lyrics";

export async function getState() {
  const metadata = await OBR.room.getMetadata();
  return metadata[NAMESPACE] || null;
}

let inFlight = false;
let pending = null;

let syncOk = true;
const NOTIFY_KEY = "netease-lyrics-sync-notify";
const NOTIFY_COOLDOWN = 3000;   // 3 秒内只弹一条

function notifySyncFailed() {
  const last = Number(localStorage.getItem(NOTIFY_KEY) || 0);
  if (Date.now() - last < NOTIFY_COOLDOWN) return;   // 另一个 iframe 刚弹过 → 跳过
  localStorage.setItem(NOTIFY_KEY, String(Date.now()));
  OBR.notification
      .show("歌词同步失败：网络异常，操作未同步到其他玩家", "ERROR")
      .catch(() => {});
}

function setSyncOk(ok) {
  if (syncOk === ok) return;
  syncOk = ok;
  if (!ok) {
    notifySyncFailed();
  } else {
    localStorage.removeItem(NOTIFY_KEY);   // 恢复后清除冷却标记，下次断网可再弹
  }
}

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
        setSyncOk(true);
      } catch (e) {
        console.warn("歌词状态同步失败，请检查网络", e);
        setSyncOk(false);
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