import { createClient } from "@supabase/supabase-js";
import { GuildMember, TextChannel, EmbedBuilder } from "discord.js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export interface WelcomeConfig {
  guild_id: string;
  enabled: boolean;
  channel_id: string;
  message: string;
  embed_color: string;
  show_banner: boolean;
  dm_enabled: boolean;
  dm_message: string;
  auto_role_id?: string;
  captcha_enabled: boolean;
}

export async function getWelcomeConfig(guildId: string): Promise<WelcomeConfig> {
  const { data, error } = await supabase
    .from("welcome_config")
    .select("*")
    .eq("guild_id", guildId)
    .single();

  if (error || !data) {
    return {
      guild_id: guildId,
      enabled: false,
      channel_id: "",
      message: "Welcome {user} to {server}!",
      embed_color: "#5865F2",
      show_banner: false,
      dm_enabled: false,
      dm_message: "Welcome to {server}!",
      captcha_enabled: false,
    };
  }

  return data;
}

export async function setWelcomeConfig(config: WelcomeConfig): Promise<void> {
  const { error } = await supabase
    .from("welcome_config")
    .upsert(config);

  if (error) throw error;
}

export async function generateWelcomeEmbed(member: GuildMember, config: WelcomeConfig): Promise<EmbedBuilder> {
  const embed = new EmbedBuilder()
    .setColor(config.embed_color as any)
    .setTitle(`🎉 Welcome to ${member.guild.name}!`)
    .setDescription(config.message
      .replace(/{user}/g, member.toString())
      .replace(/{username}/g, member.user.username)
      .replace(/{server}/g, member.guild.name)
      .replace(/{membercount}/g, member.guild.memberCount.toString()))
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: "Member Count", value: `#${member.guild.memberCount}`, inline: true },
      { name: "Account Created", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
    )
    .setTimestamp();

  return embed;
}

export async function sendWelcome(member: GuildMember): Promise<void> {
  const config = await getWelcomeConfig(member.guild.id);

  if (!config.enabled || !config.channel_id) return;

  const channel = member.guild.channels.cache.get(config.channel_id) as TextChannel;
  if (!channel) return;

  if (config.show_banner) {
    const embed = await generateWelcomeEmbed(member, config);
    await channel.send({ embeds: [embed] });
  } else {
    const message = config.message
      .replace(/{user}/g, member.toString())
      .replace(/{username}/g, member.user.username)
      .replace(/{server}/g, member.guild.name)
      .replace(/{membercount}/g, member.guild.memberCount.toString());

    await channel.send({ content: message });
  }

  // DM welcome
  if (config.dm_enabled) {
    const dmMessage = config.dm_message
      .replace(/{user}/g, member.toString())
      .replace(/{username}/g, member.user.username)
      .replace(/{server}/g, member.guild.name);

    try {
      await member.send(dmMessage);
    } catch (error) {
      // User has DMs disabled
    }
  }

  // Auto role
  if (config.auto_role_id) {
    try {
      await member.roles.add(config.auto_role_id);
    } catch (error) {
      console.error("Failed to add auto role:", error);
    }
  }
}
