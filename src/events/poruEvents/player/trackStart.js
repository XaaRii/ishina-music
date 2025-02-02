const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const formatDuration = require("../../../structures/FormatDuration.js");
const GControl = require("../../../settings/models/Control.js");
const capital = require("node-capitalize");

module.exports.run = async (client, player, track) => {
    let Control = await GControl.findOne({ guild: player.guildId });

    // This is the default setting for button control
    if (!Control) {
        Control = await GControl.create({ guild: player.guildId, playerControl: "enable" });
    }

    if (!player) return;

    const titles = track.info.title.length > 45 ? track.info.title.substr(0, 45) + "..." : track.info.title;
    const authors = track.info.author.length > 20 ? track.info.author.substr(0, 20) + "..." : track.info.author;
    const trackDuration = track.info.isStream ? "LIVE" : formatDuration(track.info.length);
    const trackAuthor = track.info.author ? authors : "Unknown";
    const trackTitle = track.info.title ? titles : "Unknown";

    const Started = new EmbedBuilder()
        .setAuthor({
            name: `Now Playing`,
            iconURL: "https://cdn.discordapp.com/attachments/1014342568554811443/1025740239236517908/music-disc.gif",
        })
        .setThumbnail(track.info.image)
        .setDescription(`**[${trackTitle}](${track.info.uri})**`)
        .addFields([
            { name: `Author:`, value: `${trackAuthor}`, inline: true },
            { name: `Requested By:`, value: `${track.info.requester}`, inline: true },
            { name: `Duration:`, value: `${trackDuration}`, inline: true },
        ])
        .setColor(client.color)
        .setFooter({ text: `Loop Mode: ${capital(player.loop)} • Queue Left: ${player.queue.length} • Autoplay: ${player.autoplay === true ? "true" : "false"} • Volume: ${player.volume}%` });

    const emoji = client.emoji.button;

    const bLoop = new ButtonBuilder().setCustomId("loop").setEmoji(emoji.loop.none).setStyle(ButtonStyle.Secondary);
    const bPrev = new ButtonBuilder().setCustomId("prev").setEmoji(emoji.previous).setStyle(ButtonStyle.Secondary);
    const bPause = new ButtonBuilder().setCustomId("pause").setEmoji(emoji.pause).setStyle(ButtonStyle.Secondary);
    const bSkip = new ButtonBuilder().setCustomId("skip").setEmoji(emoji.skip).setStyle(ButtonStyle.Secondary);
    const bAutoplay = new ButtonBuilder().setCustomId("autoplay").setEmoji(emoji.autoplay).setStyle(ButtonStyle.Secondary);
    const bShuffle = new ButtonBuilder().setCustomId("shuffle").setEmoji(emoji.shuffle).setStyle(ButtonStyle.Secondary);
    const bVDown = new ButtonBuilder().setCustomId("voldown").setEmoji(emoji.voldown).setStyle(ButtonStyle.Secondary);
    const bStop = new ButtonBuilder().setCustomId("stop").setEmoji(emoji.stop).setStyle(ButtonStyle.Danger);
    const bVUp = new ButtonBuilder().setCustomId("volup").setEmoji(emoji.volup).setStyle(ButtonStyle.Secondary);
    const bInfo = new ButtonBuilder().setCustomId("info").setEmoji(emoji.info).setStyle(ButtonStyle.Secondary);

    const button = new ActionRowBuilder().addComponents(bLoop, bPrev, bPause, bSkip, bAutoplay);
    const button2 = new ActionRowBuilder().addComponents(bShuffle, bVDown, bStop, bVUp, bInfo);

    // When set to "disable", button control won't show.
    if (Control.playerControl === "disable") {
        return client.channels.cache
            .get(player.textChannel)
            .send({ embeds: [Started] })
            .then((x) => (player.message = x));
    }

    const nplaying = await client.channels.cache
        .get(player.textChannel)
        .send({ embeds: [Started], components: [button, button2] })
        .then((x) => (player.message = x));

    const filter = (message) => {
        if (message.guild.members.me.voice.channel && message.guild.members.me.voice.channelId === message.member.voice.channelId)
            return true;
        else {
            message.reply({
                content: `\`❌\` | You must be in the same voice channel as me to use this button.`,
                ephemeral: true,
            });
            return false;
        }
    };

    const collector = nplaying.createMessageComponentCollector({ filter, time: track.info.length });

    collector.on("collect", async (message) => {
        if (!player) return collector.stop();
        switch (message.customId) {
            case "loop":
                message.deferUpdate();
                switch (player.loop) {
                    case "NONE":
                        player.setLoop("TRACK");
                        bLoop.setEmoji(emoji.loop.track).setStyle(ButtonStyle.Primary);
                        break;
                    case "TRACK":
                        player.setLoop("QUEUE");
                        bLoop.setEmoji(emoji.loop.queue).setStyle(ButtonStyle.Success);
                        break;
                    case "QUEUE":
                        player.setLoop("NONE");
                        bLoop.setEmoji(emoji.loop.none).setStyle(ButtonStyle.Secondary);
                        break;
                }
                Started.setFooter({
                    text: `Loop Mode: ${capital(player.loop)} • Queue Left: ${player.queue.length} • Autoplay: ${player.autoplay === true ? "true" : "false"} • Volume: ${player.volume}%`,
                });
                await nplaying.edit({ embeds: [Started], components: [button, button2] });
                break;
            case "autoplay":
                const e = new EmbedBuilder().setColor(client.color);
                const currentsong = player.currentTrack.info;
                const ytUri = /^(https?:\/\/)?(www\.)?(m\.)?(music\.)?(youtube\.com|youtu\.?be)\/.+$/gi.test(currentsong.uri);
                if (!ytUri) {
                    e.setDescription(`\`❌\` | Autoplay feature only supports YouTube!`);
                    return message.reply({ embeds: [e], ephemeral: true });
                }
                if (player.autoplay === true) {
                    player.autoplay = false;
                    if (player.queue.length < 2) await player.queue.clear();
                    e.setDescription(`\`🔴\` | Autoplay has been \`disabled\``);
                    message.reply({ embeds: [e], ephemeral: true });
                } else {
                    player.autoplay = true;
                    if (ytUri) {
                        const identifier = currentsong.identifier;
                        const search = `https://music.youtube.com/watch?v=${identifier}&list=RD${identifier}`;
                        const res = await client.poru.resolve({ query: search, source: "ytmsearch", requester: message.user });
        
                        await player.queue.add(res.tracks[Math.floor(Math.random() * res.tracks.length) ?? 1]);
        
                        e.setDescription(`\`🔵\` | Autoplay has been \`enabled\`, 1 song added.`);
                        message.reply({ embeds: [e], ephemeral: true });
                    }
                }
                Started.setFooter({
                    text: `Loop Mode: ${capital(player.loop)} • Queue Left: ${player.queue.length} • Autoplay: ${player.autoplay === true ? "true" : "false"} • Volume: ${player.volume}%`,
                });
                await nplaying.edit({ embeds: [Started], components: [button, button2] });
                break;
            case "replay":
                if (!player.currentTrack.info.isSeekable) {
                    const embed = new EmbedBuilder().setColor(client.color).setDescription(`\`❌\` | Song can't be replayed`);
                    return message.reply({ embeds: [embed], ephemeral: true });
                } else {
                    message.deferUpdate();
                    await player.seekTo(0);
                }
                break;
            case "stop":
                message.deferUpdate();
                if (player.message) await player.message.delete();
                await player.destroy();
                break;
            case "pause":
                message.deferUpdate();
                if (player.isPaused) {
                    player.pause(false);
                    Started.setAuthor({
                        name: `Now Playing`,
                        iconURL: "https://cdn.discordapp.com/attachments/1014342568554811443/1025740239236517908/music-disc.gif",
                    });
                    bPause.setEmoji(emoji.pause).setStyle(ButtonStyle.Secondary);
                } else {
                    player.pause(true);
                    Started.setAuthor({
                        name: `Song Paused`,
                        iconURL: "https://cdn.discordapp.com/attachments/1014342568554811443/1025740239236517908/music-disc.gif",
                    });
                    bPause.setEmoji(emoji.resume).setStyle(ButtonStyle.Primary);
                }
                await nplaying.edit({ embeds: [Started], components: [button, button2] });
                break;
            case "skip":
                if (!player || player.queue.size == 0) {
                    const embed = new EmbedBuilder().setDescription(`\`❌\` | No more songs in queue to skip to.`).setColor(client.color);
                    return message.reply({ embeds: [embed], ephemeral: true });
                } else {
                    message.deferUpdate();
                    await player.stop();
                }
                break;
            case "prev":
                if (!player.previousTrack) {
                    const embed = new EmbedBuilder().setDescription(`\`❌\` | Couldn't find any previous songs in this queue.`).setColor(client.color);
                    return message.reply({ embeds: [embed], ephemeral: true });
                } else {
                    message.deferUpdate();
                    await player.queue.unshift(player.previousTrack);
                    await player.stop();
                }
                break;
            case "shuffle":
                if (!player.queue.length) {
                    const embed = new EmbedBuilder().setDescription(`\`❌\` | Queue is empty, nothing to shuffle.`).setColor(client.color);
                    return message.reply({ embeds: [embed], ephemeral: true });
                } else {
                    message.deferUpdate();
                    await player.queue.shuffle();
                }
                break;
            case "voldown":
                if (player.volume < 20) {
                    await player.setVolume(10);
                    const embed = new EmbedBuilder().setDescription(`\`❌\` | Volume can't be lower than \`10%\``).setColor(client.color);
                    return message.reply({ embeds: [embed], ephemeral: true });
                } else {
                    message.deferUpdate();
                    await player.setVolume(player.volume - 10);
                    Started.setFooter({
                        text: `Loop Mode: ${capital(player.loop)} • Queue Left: ${player.queue.length} • Autoplay: ${player.autoplay === true ? "true" : "false"} • Volume: ${player.volume}%`,
                    });
                    await nplaying.edit({ embeds: [Started], components: [button, button2] });
                }
                break;
            case "volup":
                if (player.volume > 90) {
                    await player.setVolume(100);
                    const embed = new EmbedBuilder().setDescription(`\`❌\` | Volume can't be higher than \`100%\``).setColor(client.color);
                    return message.reply({ embeds: [embed], ephemeral: true });
                } else {
                    message.deferUpdate();
                    await player.setVolume(player.volume + 10);
                    Started.setFooter({
                        text: `Loop Mode: ${capital(player.loop)} • Queue Left: ${player.queue.length} • Autoplay: ${player.autoplay === true ? "true" : "false"} • Volume: ${player.volume}%`,
                    });
                    await nplaying.edit({ embeds: [Started], components: [button, button2] });
                }
                break;
            case "info":
                const Titles =
                    player.currentTrack.info.title.length > 200
                        ? player.currentTrack.info.title.substr(0, 200) + "..."
                        : player.currentTrack.info.title;
                const Author =
                    player.currentTrack.info.author.length > 60
                        ? player.currentTrack.info.author.substr(0, 60) + "..."
                        : player.currentTrack.info.author;
                const currentPosition = formatDuration(player.position);
                const trackDuration = formatDuration(player.currentTrack.info.length);
                const playerDuration = player.currentTrack.info.isStream ? "LIVE" : trackDuration;
                const currentAuthor = player.currentTrack.info.author ? Author : "Unknown";
                const currentTitle = player.currentTrack.info.title ? Titles : "Unknown";
                const Part = Math.floor((player.position / player.currentTrack.info.length) * 30);
                const Emoji = player.isPlaying ? "🕒 |" : "⏸ |";

                let sources = "Unknown";
                switch (player.currentTrack.info.sourceName) {
                    case "youtube":
                        sources = "YouTube";
                        break;
                    case "soundcloud":
                        sources = "SoundCloud";
                        break;
                    case "spotify":
                        sources = "Spotify";
                        break;
                    case "applemusic":
                        sources = "Apple Music";
                        break;
                    case "bandcamp":
                        sources = "Bandcamp";
                        break;
                    case "http":
                        sources = "HTTP";
                        break;
                }

                const embed = new EmbedBuilder()
                    .setAuthor({
                        name: player.isPlaying ? `Now Playing` : `Song Paused`,
                        iconURL: "https://cdn.discordapp.com/attachments/1014342568554811443/1025740239236517908/music-disc.gif",
                    })
                    .setThumbnail(player.currentTrack.info.image)
                    .setDescription(`**[${currentTitle}](${player.currentTrack.info.uri})**`)
                    .addFields([
                        { name: `Author:`, value: `${currentAuthor}`, inline: true },
                        { name: `Requested By:`, value: `${player.currentTrack.info.requester}`, inline: true },
                        { name: `Source:`, value: `${sources}`, inline: true },
                        { name: `Duration:`, value: `${playerDuration}`, inline: true },
                        { name: `Volume:`, value: `${player.volume}%`, inline: true },
                        { name: `Queue Left:`, value: `${player.queue.length}`, inline: true },
                        {
                            name: `Song Progress: \`[${currentPosition}]\``,
                            value: `\`\`\`${Emoji} ${"─".repeat(Part) + "🔵" + "─".repeat(30 - Part)}\`\`\``,
                            inline: false,
                        },
                    ])
                    .setColor(client.color)
                    .setFooter({ text: `© ${client.user.username}` })
                    .setTimestamp();
                message.reply({ embeds: [embed], ephemeral: true });
                break;
        }
    });
};
