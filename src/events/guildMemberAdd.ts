
import { EmbedBuilder } from "discord.js";
import { supabase } from "../database/supabase.js";
import { trackInvite } from "../systems/invites/inviteTracker.js";
import { isBlacklisted } from "../systems/security/blacklist.js";
import { startCaptcha, getCaptchaConfig } from "../systems/captcha/captcha.js";
import { log } from "../lib/logger.js";

function checkAccountAge(member: any, minDays: number = 7): { isTooNew: boolean; accountAge: number } {
  const accountAge = Date.now() - member.user.createdTimestamp;
  const minAgeMs = minDays * 24 * 60 * 60 * 1000;
  return {
    isTooNew: accountAge < minAgeMs,
    accountAge: Math.floor(accountAge / (24 * 60 * 60 * 1000)), // days
  };
}

export default {
  name: "guildMemberAdd",
  async execute(member: any) {
    const { data: settings } = await supabase
      .from("guild_settings")
      .select("autorole_id, welcome_channel_id, welcome_message, min_account_age_days")
      .eq("guild_id", member.guild.id)
      .maybeSingle();

    // Check blacklist
    if (await isBlacklisted(member.guild.id, member.user.id)) {
      await member.kick("You are blacklisted from this server.").catch(() => {});
      return;
    }

    // Check account age
    const minAccountAge = settings?.min_account_age_days || 0;
    if (minAccountAge > 0) {
      const { isTooNew, accountAge } = checkAccountAge(member, minAccountAge);
      if (isTooNew) {
        // Account is too new, kick or notify based on settings
        await member.kick(`Account is too new (${accountAge} days old, minimum is ${minAccountAge} days)`).catch(() => {});
        return;
      }
    }

    if (settings?.autorole_id) {
      const role = member.guild.roles.cache.get(settings.autorole_id);
      if (role) await member.roles.add(role).catch(console.error);
    }

    // Captcha: if enabled for this guild, start verification BEFORE invite
    // tracking/rewards so unverified members cannot farm invites. (C-02 wiring)
    try {
      const captchaCfg = await getCaptchaConfig(member.guild.id);
      if (captchaCfg.enabled && captchaCfg.channel_id) {
        await startCaptcha(member);
        return; // do not process invite rewards until verified
      }
    } catch (err: any) {
      log.error("startCaptcha failed", { error: err?.message, guild: member.guild.id });
    }

    await trackInvite(member);

    // Welcome message
    if (settings?.welcome_channel_id) {
      const channel = member.guild.channels.cache.get(settings.welcome_channel_id);
      if (channel) {
        const defaultMsg = "Welcome to {server}, {user}! 🎉 You are member #{memberCount}!";
        const template = settings.welcome_message || defaultMsg;
        const text = template
          .replace(/{user}/g, `<@${member.id}>`)
          .replace(/{server}/g, member.guild.name)
          .replace(/{memberCount}/g, String(member.guild.memberCount));

        const embed = new EmbedBuilder()
          .setTitle("👋 Welcome!")
          .setDescription(text)
          .setColor(0x57f287)
          .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
          .setTimestamp();

        await channel.send({ embeds: [embed] }).catch(console.error);
      }
    }
  },
};
