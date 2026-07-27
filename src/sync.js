import OBR from "@owlbear-rodeo/sdk";

const NAMESPACE = "com.owlbear-netease-lyrics";

export async function getState() {
  const metadata = await OBR.room.getMetadata();
  return metadata[NAMESPACE] || null;
}

export async function setState(state) {
  await OBR.room.setMetadata({ [NAMESPACE]: state });
  OBR.broadcast.sendMessage(`${NAMESPACE}/sync`, {}, { destination: "ALL" });
}

export function onStateChange(callback) {
  OBR.room.onMetadataChange((metadata) => {
    const state = metadata[NAMESPACE];
    if (state) callback(state);
  });

  OBR.broadcast.onMessage(`${NAMESPACE}/sync`, async () => {
    const state = await getState();
    if (state) callback(state);
  });
}
