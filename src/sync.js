import OBR from "@owlbear-rodeo/sdk";

const NAMESPACE = "com.owlbear-netease-lyrics";

export async function getState() {
  const metadata = await OBR.room.getMetadata();
  return metadata[NAMESPACE] || null;
}

export async function setState(state) {
  await OBR.room.setMetadata({ [NAMESPACE]: state });
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
