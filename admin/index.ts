import wordmark from "../public/brand/wordmark.svg";
import font from "../public/brand/bricolage.woff2";
import icon from "../public/icon.svg";
import { createHandler, type AdminEnv } from "./handler";
import { syncEdge } from "./edge";
export default {
  fetch: createHandler({ font, icon, wordmark }),
  async scheduled(_event: ScheduledController, env: AdminEnv) {
    if (!(await syncEdge(env))) throw Error("Edge archive did not refresh");
  },
};
