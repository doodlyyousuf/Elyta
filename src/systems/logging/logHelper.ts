import { EmbedBuilder } from "discord.js";

export async function sendModLog(guild: any, title: string, description: string, color = 0x5865f2) {
  let channel = guild.channels.cache.get("1511435793028218941");
  if (!channel) {
    channel = guild.channels.cache.find((c: any) => c.name === "mod-logs" && c.isTextBased());
  }
  if (!channel) {
    channel = await guild.channels.create({ name: "mod-logs", topic: "Moderation logs" }).catch(() => null);
  }
  if (!channel) return;
  const embed = new EmbedBuilder().setTitle(title).setDescription(description).setColor(color).setTimestamp();
  await channel.send({ embeds: [embed] }).catch(() => {});
}

export async function sendRoleLog(guild: any, title: string, description: string, color = 0x5865f2) {
  let channel = guild.channels.cache.find((c: any) => c.name === "role-logs" && c.isTextBased());
  if (!channel) {
    channel = await guild.channels.create({ name: "role-logs", topic: "Role change logs" }).catch(() => null);
  }
  if (!channel) return;
  const embed = new EmbedBuilder().setTitle(title).setDescription(description).setColor(color).setTimestamp();
  await channel.send({ embeds: [embed] }).catch(() => {});
}

export async function sendChannelLog(guild: any, title: string, description: string, color = 0x5865f2) {
  let channel = guild.channels.cache.find((c: any) => c.name === "channel-logs" && c.isTextBased());
  if (!channel) {
    channel = await guild.channels.create({ name: "channel-logs", topic: "Channel update logs" }).catch(() => null);
  }
  if (!channel) return;
  const embed = new EmbedBuilder().setTitle(title).setDescription(description).setColor(color).setTimestamp();
  await channel.send({ embeds: [embed] }).catch(() => {});
}
