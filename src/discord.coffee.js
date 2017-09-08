var Adapter, Discord, DiscordBot, EnterMessage, LeaveMessage, Robot, TextChannel, TextMessage, TopicMessage, User, currentlyPlaying, prequire, ref, ref1,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty,
  slice = [].slice;

try {
  ref = require('hubot'), Robot = ref.Robot, Adapter = ref.Adapter, EnterMessage = ref.EnterMessage, LeaveMessage = ref.LeaveMessage, TopicMessage = ref.TopicMessage, TextMessage = ref.TextMessage, User = ref.User;
} catch (_error) {
  prequire = require('parent-require');
  ref1 = prequire('hubot'), Robot = ref1.Robot, Adapter = ref1.Adapter, EnterMessage = ref1.EnterMessage, LeaveMessage = ref1.LeaveMessage, TopicMessage = ref1.TopicMessage, TextMessage = ref1.TextMessage, User = ref1.User;
}

Discord = require("discord.js");

TextChannel = Discord.TextChannel;

currentlyPlaying = process.env.HUBOT_DISCORD_STATUS_MSG || '';

DiscordBot = (function(superClass) {
  extend(DiscordBot, superClass);

  function DiscordBot(robot) {
    this.disconnected = bind(this.disconnected, this);
    this.message = bind(this.message, this);
    this.ready = bind(this.ready, this);
    DiscordBot.__super__.constructor.apply(this, arguments);
    this.rooms = {};
    if (process.env.HUBOT_DISCORD_TOKEN == null) {
      this.robot.logger.error("Error: Environment variable named `HUBOT_DISCORD_TOKEN` required");
      return;
    }
  }

  DiscordBot.prototype.run = function() {
    this.options = {
      token: process.env.HUBOT_DISCORD_TOKEN
    };
    this.client = new Discord.Client({
      autoReconnect: true,
      fetch_all_members: true,
      api_request_method: 'burst',
      ws: {
        compress: true,
        large_threshold: 1000
      }
    });
    this.robot.client = this.client;
    this.client.on('ready', this.ready);
    this.client.on('message', this.message);
    this.client.on('disconnected', this.disconnected);
    return this.client.login(this.options.token)["catch"](this.robot.logger.error);
  };

  DiscordBot.prototype.ready = function() {
    var channel, i, len, ref2;
    this.robot.logger.info("Logged in: " + this.client.user.username + "#" + this.client.user.discriminator);
    this.robot.name = this.client.user.username;
    this.robot.logger.info("Robot Name: " + this.robot.name);
    this.emit("connected");
    ref2 = this.client.channels;
    for (i = 0, len = ref2.length; i < len; i++) {
      channel = ref2[i];
      this.rooms[channel.id] = channel;
    }
    return this.client.user.setStatus('online', currentlyPlaying).then(this.robot.logger.debug("Status set to " + currentlyPlaying))["catch"](this.robot.logger.error);
  };

  DiscordBot.prototype.message = function(message) {
    var base, name, text, user;
    if (message.author.id === this.client.user.id) {
      return;
    }
    user = this.robot.brain.userForId(message.author.id);
    user.room = message.channel.id;
    user.name = message.author.username;
    user.discriminator = message.author.discriminator;
    user.id = message.author.id;
    if ((base = this.rooms)[name = message.channel.id] == null) {
      base[name] = message.channel;
    }
    text = message.cleanContent;
    if (((message != null ? message.channel : void 0) != null) instanceof Discord.DMChannel) {
      if (!text.match(new RegExp("^@?" + this.robot.name))) {
        text = this.robot.name + ": " + text;
      }
    }
    this.robot.logger.debug(text);
    return this.receive(new TextMessage(user, text, message.id));
  };

  DiscordBot.prototype.disconnected = function() {
    return this.robot.logger.info(this.robot.name + " Disconnected, will auto reconnect soon...");
  };

  DiscordBot.prototype.send = function() {
    var envelope, i, len, message, messages, results;
    envelope = arguments[0], messages = 2 <= arguments.length ? slice.call(arguments, 1) : [];
    results = [];
    for (i = 0, len = messages.length; i < len; i++) {
      message = messages[i];
      results.push(this.sendMessage(envelope.room, message));
    }
    return results;
  };

  DiscordBot.prototype.reply = function() {
    var envelope, i, len, message, messages, results;
    envelope = arguments[0], messages = 2 <= arguments.length ? slice.call(arguments, 1) : [];
    results = [];
    for (i = 0, len = messages.length; i < len; i++) {
      message = messages[i];
      results.push(this.sendMessage(envelope.room, "<@" + envelope.user.id + "> " + message));
    }
    return results;
  };

  DiscordBot.prototype.sendMessage = function(channelId, message) {
    var channels, errorHandle, robot, sendChannelMessage, sendUserMessage, zSWC;
    errorHandle = function(err) {
      return robot.logger.error("Error sending: " + message + "\r\n" + err);
    };
    zSWC = "\u200B";
    message = zSWC + message;
    robot = this.robot;
    sendChannelMessage = function(channel, message) {
      var clientUser, hasPerm, isText, owner, permissions, ref2;
      clientUser = robot != null ? (ref2 = robot.client) != null ? ref2.user : void 0 : void 0;
      isText = channel !== null && channel.type === 'text';
      permissions = isText && channel.permissionsFor(clientUser);
      hasPerm = isText ? permissions !== null && permissions.hasPermission("SEND_MESSAGES") : channel.type !== 'text';
      if (hasPerm) {
        return channel.sendMessage(message, {
          split: true
        }).then(function(msg) {
          return robot.logger.debug("SUCCESS! Message sent to: " + channel.id);
        })["catch"](function(err) {
          var owner;
          robot.logger.debug("Error sending: " + message + "\r\n" + err);
          if (process.env.HUBOT_OWNER) {
            owner = robot.client.users.get(process.env.HUBOT_OWNER);
            return owner.sendMessage("Couldn't send message to " + channel.name + " (" + channel + ") in " + channel.guild.name + ", contact " + channel.guild.owner + ".\r\n" + error).then(function(msg) {
              return robot.logger.debug("SUCCESS! Message sent to: " + owner.id);
            })["catch"](function(err) {
              return robot.logger.debug("Error sending: " + message + "\r\n" + err);
            });
          }
        });
      } else {
        robot.logger.debug("Can't send message to " + channel.name + ", permission denied");
        if (process.env.HUBOT_OWNER) {
          owner = robot.client.users.get(process.env.HUBOT_OWNER);
          return owner.sendMessage("Couldn't send message to " + channel.name + " (" + channel + ") in " + channel.guild.name + ", contact " + channel.guild.owner + " to check permissions").then(function(msg) {
            return robot.logger.debug("SUCCESS! Message sent to: " + owner.id);
          })["catch"](function(err) {
            return robot.logger.debug("Error sending: " + message + "\r\n" + err);
          });
        }
      }
    };
    sendUserMessage = function(user, message) {
      return user.sendMessage(message, {
        split: true
      }).then(function(msg) {
        return robot.logger.debug("SUCCESS! Message sent to: " + user.id);
      })["catch"](function(err) {
        return robot.logger.debug("Error sending: " + message + "\r\n" + err);
      });
    };
    if (this.rooms[channelId] != null) {
      return sendChannelMessage(this.rooms[channelId], message);
    } else {
      channels = this.client.channels.filter(function(channel) {
        return channel.id === channelId;
      });
      if (channels.first() != null) {
        return sendChannelMessage(channels.first(), message);
      } else if (this.client.users.get(channelId) != null) {
        return sendUserMessage(this.client.users.get(channelId), message);
      } else {
        return this.robot.logger.debug("Unknown channel id: " + channelId);
      }
    }
  };

  DiscordBot.prototype.channelDelete = function(channel, client) {
    var roomId, user;
    roomId = channel.id;
    user = new User(client.user.id);
    user.room = roomId;
    user.name = client.user.username;
    user.discriminator = client.user.discriminator;
    user.id = client.user.id;
    this.robot.logger.info("" + user.name + user.discriminator + " leaving " + roomId + " after a channel delete");
    return this.receive(new LeaveMessage(user, null, null));
  };

  DiscordBot.prototype.guildDelete = function(guild, client) {
    var channel, results, room, roomIds, serverId, user;
    serverId = guild.id;
    roomIds = (function() {
      var i, len, ref2, results;
      ref2 = guild.channels;
      results = [];
      for (i = 0, len = ref2.length; i < len; i++) {
        channel = ref2[i];
        results.push(channel.id);
      }
      return results;
    })();
    results = [];
    for (room in rooms) {
      user = new User(client.user.id);
      user.room = room.id;
      user.name = client.user.username;
      user.discriminator = client.user.discriminator;
      user.id = client.user.id;
      this.robot.logger.info("" + user.name + user.discriminator + " leaving " + roomId + " after a guild delete");
      results.push(this.receive(new LeaveMessage(user, null, null)));
    }
    return results;
  };

  return DiscordBot;

})(Adapter);

exports.use = function(robot) {
  return new DiscordBot(robot);
};

// ---
// generated by coffee-script 1.9.2
