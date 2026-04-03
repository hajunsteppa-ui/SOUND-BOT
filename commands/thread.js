module.exports = {
  config: {
    name: "thread"
  },

  run: async ({ api, event, args, db, admins }) => {
    const { threadID } = event;

    if (!admins.includes(event.senderID)) {
      return api.sendMessage("❌ no permission", threadID);
    }

    const action = args[0];
    const target = args[1];

    const col = db.collection("bannedThreads");

    if (action === "ban") {
      await col.insertOne({ threadID: target });
      return api.sendMessage("banned", threadID);
    }

    if (action === "unban") {
      await col.deleteOne({ threadID: target });
      return api.sendMessage("unbanned", threadID);
    }

    if (action === "list") {
      const list = await col.find();

      let msg = "banned:\n";
      list.forEach(x => msg += x.threadID + "\n");

      return api.sendMessage(msg, threadID);
    }
  }
};