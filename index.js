const login = require("fca-unofficial");
const fs = require("fs");
const express = require("express");

const config = require("./config.json");

// ===== SIMPLE MEMORY DB =====
global.db = {
  data: { bannedThreads: [] },
  collection(name) {
    return {
      find: async () => this.data[name],
      findOne: async (q) =>
        this.data[name].find(x => x.threadID === q.threadID),
      insertOne: async (doc) => this.data[name].push(doc),
      deleteOne: async (q) => {
        this.data[name] = this.data[name].filter(
          x => x.threadID !== q.threadID
        );
      }
    };
  }
};

// ===== BAN CHECK =====
global.checkThreadBan = async function (threadID) {
  const col = global.db.collection("bannedThreads");
  const found = await col.findOne({ threadID: threadID.toString() });
  return !!found;
};

// ===== LOAD COMMANDS =====
const commands = {};
fs.readdirSync("./commands").forEach(file => {
  const cmd = require(`./commands/${file}`);
  commands[cmd.config.name] = cmd;
});

// ===== LOGIN =====
login(
  {
    email: config.email,
    password: config.password
  },
  (err, api) => {
    if (err) return console.error(err);

    global.api = api;

    api.setOptions({ listenEvents: true });

    // ===== WEB PANEL =====
    require("./web/panel")(api, config);

    api.listenMqtt(async (err, event) => {
      if (err) return console.error(err);

      const { threadID, logMessageType, logMessageData } = event;

      // 🚫 banned threads
      if (await global.checkThreadBan(threadID)) return;

      // =========================
      // AUTO LEAVE / AUTO KICK
      // =========================
      if (logMessageType === "log:subscribe") {

        const added = logMessageData.addedParticipants || [];
        const botID = api.getCurrentUserID();

        const botAdded = added.some(u => u.userFbId == botID);

        if (botAdded) {
          const adder = logMessageData.author;

          // auto leave
          if (config.autoLeave) {
            api.sendMessage("🚫 leaving...", threadID, () => {
              api.removeUserFromGroup(botID, threadID);
            });
            return;
          }

          // auto kick adder
          if (config.autoKick && !config.admins.includes(adder)) {
            try {
              await api.removeUserFromGroup(adder, threadID);
            } catch {}
          }
        }
      }

      // =========================
      // AUTO KICK WHEN BOT GET ADMIN
      // =========================
      if (logMessageType === "log:thread-admins") {

        const botID = api.getCurrentUserID();
        const target = logMessageData.TARGET_ID;
        const isAdd = logMessageData.ADMIN_EVENT === "add_admin";

        if (target == botID && isAdd) {
          const author = logMessageData.author;

          if (config.autoKick && !config.admins.includes(author)) {
            try {
              await api.removeUserFromGroup(author, threadID);
            } catch {}
          }
        }
      }

      // =========================
      // COMMANDS
      // =========================
      const { body } = event;

      if (body && body.startsWith("/")) {
        const args = body.slice(1).split(" ");
        const cmdName = args.shift().toLowerCase();

        const cmd = commands[cmdName];
        if (cmd) {
          return cmd.run({
            api,
            event,
            args,
            db: global.db,
            admins: config.admins
          });
        }
      }

      // =========================
      // NON PREFIX (spam)
      // =========================
      for (let name in commands) {
        const cmd = commands[name];
        if (cmd.handleEvent) {
          await cmd.handleEvent({ api, event });
        }
      }
    });
  }
);