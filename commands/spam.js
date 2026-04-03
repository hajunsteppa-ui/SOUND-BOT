const OWNER_ID = "61579551575273";

let active = {};
let lists = {};
let index = {};

module.exports = {
  config: {
    name: "spam",
    nonPrefix: true
  },

  handleEvent: async ({ api, event }) => {
    const { threadID, body, senderID } = event;
    if (!body) return;

    const msg = body.toLowerCase();

    if (senderID == OWNER_ID && msg.startsWith("andar ")) {
      lists[threadID] = body.slice(6).split(",").map(x => x.trim());
      index[threadID] = 0;
      return;
    }

    if (senderID == OWNER_ID && msg === "start") {
      active[threadID] = true;
      return;
    }

    if (senderID == OWNER_ID && msg === "✓") {
      delete active[threadID];
      return;
    }

    if (!active[threadID]) return;
    if (senderID == api.getCurrentUserID()) return;

    const arr = lists[threadID] || ["😴", "spam"];
    const i = index[threadID] || 0;

    setTimeout(() => {
      api.sendMessage(arr[i % arr.length], threadID);
    }, 3000);

    index[threadID] = i + 1;
  }
};
