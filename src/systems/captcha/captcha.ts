import { createClient } from "@supabase/supabase-js";
import { GuildMember, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "discord.js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export interface CaptchaConfig {
  guild_id: string;
  enabled: boolean;
  channel_id: string;
  role_id: string;
  difficulty: "easy" | "medium" | "hard";
  timeout: number;
}

export interface CaptchaSession {
  user_id: string;
  guild_id: string;
  code: string;
  created_at: string;
}

const activeSessions = new Map<string, CaptchaSession>();

export async function getCaptchaConfig(guildId: string): Promise<CaptchaConfig> {
  const { data, error } = await supabase
    .from("captcha_config")
    .select("*")
    .eq("guild_id", guildId)
    .single();

  if (error || !data) {
    return {
      guild_id: guildId,
      enabled: false,
      channel_id: "",
      role_id: "",
      difficulty: "medium",
      timeout: 300000,
    };
  }

  return data;
}

export async function setCaptchaConfig(config: CaptchaConfig): Promise<void> {
  const { error } = await supabase
    .from("captcha_config")
    .upsert(config);

  if (error) throw error;
}

export function generateCaptchaCode(difficulty: "easy" | "medium" | "hard"): string {
  const length = difficulty === "easy" ? 4 : difficulty === "medium" ? 5 : 6;
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < length; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return code;
}

export async function startCaptcha(member: GuildMember): Promise<void> {
  const config = await getCaptchaConfig(member.guild.id);

  if (!config.enabled || !config.channel_id) return;

  const channel = member.guild.channels.cache.get(config.channel_id) as TextChannel;
  if (!channel) return;

  const code = generateCaptchaCode(config.difficulty);

  const session: CaptchaSession = {
    user_id: member.id,
    guild_id: member.guild.id,
    code,
    created_at: new Date().toISOString(),
  };

  activeSessions.set(`${member.guild.id}-${member.id}`, session);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`captcha_verify_${member.id}`)
        .setPlaceholder(`Select the code: ${code}`)
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel(code).setValue(code),
          new StringSelectMenuOptionBuilder().setLabel(generateCaptchaCode(config.difficulty)).setValue("wrong1"),
          new StringSelectMenuOptionBuilder().setLabel(generateCaptchaCode(config.difficulty)).setValue("wrong2"),
          new StringSelectMenuOptionBuilder().setLabel(generateCaptchaCode(config.difficulty)).setValue("wrong3"),
        )
    );

  await channel.send({
    content: `🔐 ${member}, please select the correct code from the dropdown to verify you're human.`,
    components: [row],
  });

  // Timeout
  setTimeout(async () => {
    const sessionKey = `${member.guild.id}-${member.id}`;
    if (activeSessions.has(sessionKey)) {
      activeSessions.delete(sessionKey);
      try {
        await member.kick("Captcha verification timeout");
      } catch (error) {
        console.error("Failed to kick member:", error);
      }
    }
  }, config.timeout);
}

export async function verifyCaptcha(userId: string, guildId: string, input: string): Promise<boolean> {
  const sessionKey = `${guildId}-${userId}`;
  const session = activeSessions.get(sessionKey);

  if (!session) return false;

  if (input.toUpperCase() === session.code) {
    activeSessions.delete(sessionKey);
    return true;
  }

  return false;
}

export function getCaptchaSession(userId: string, guildId: string): CaptchaSession | undefined {
  return activeSessions.get(`${guildId}-${userId}`);
}
