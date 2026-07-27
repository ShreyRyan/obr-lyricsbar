import OBR from "@owlbear-rodeo/sdk";
import { mountDM } from "./dm.js";
import { mountPL } from "./pl.js";
import "./style.css";

OBR.onReady(async () => {
  const role = await OBR.player.getRole();
  const root = document.getElementById("app");

  if (role === "GM") {
    mountDM(root);
  } else {
    mountPL(root);
  }
});
