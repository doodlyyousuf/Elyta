
import { createCanvas } from "@napi-rs/canvas";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Client,
  type GuildMember,
  type TextChannel,
} from "discord.js";
import { supabase } from "../../database/supabase.js";
import { client } from "../../client.js";

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
  expires_at: string;
  verified: boolean;
}

export async function getCaptchaConfig(guildId: string): Promise<CaptchaConfig> {
  const { data, error } = await supabase
    .from("captcha_config")
    .select("*")
    .eq("guild_id", guildId)
    .maybeSingle();

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

  return data as CaptchaConfig;
}

export async function setCaptchaConfig(config: CaptchaConfig): Promise<void> {
  const { error } = await supabase.from("captcha_config").upsert(config);
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

/**
 * Render the captcha `code` to a PNG Buffer with noise lines/dots and per-char
 * rotation + colour, so the code is NOT readable from the message's component
 * data (C-02 fix).
 */
function renderCaptchaImage(code: string): Buffer {
  const width = 300;
  const height = 100;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Noise lines (4–6 random)
  const lineCount = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < lineCount; i++) {
    const r = Math.floor(Math.random() * 180);
    const g = Math.floor(Math.random() * 180);
    const b = Math.floor(Math.random() * 180);
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.55)`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(Math.random() * width, Math.random() * height);
    ctx.lineTo(Math.random() * width, Math.random() * height);
    ctx.stroke();
  }

  // Code characters — random rotation, colour, vertical jitter
  const colors = ["#e74c3c", "#2980b9", "#27ae60", "#c0392b", "#8e44ad", "#d35400", "#16a085"];
  const slot = width / (code.length + 1);
  for (let i = 0; i < code.length; i++) {
    ctx.save();
    const x = slot * (i + 1);
    const y = height / 2 + (Math.random() * 20 - 10);
    ctx.translate(x, y);
    ctx.rotate((Math.random() - 0.5) * 0.7); // up to ~40° either way
    ctx.font = "bold 44px sans-serif";
    ctx.fillStyle = colors[i % colors.length];
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(code[i], 0, 0);
    ctx.restore();
  }

  // Speckle noise dots
  for (let i = 0; i < 100; i++) {
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.25})`;
    ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2);
  }

  return canvas.toBuffer("image/png");
}

/**
 * Start a captcha challenge for a newly-joined member.
 *
 * Fixes:
 *   • C-02 (Critical, Security): the code is no longer embedded in the
 *     component data. We render it as a PNG image (with noise/distortion) and
 *     attach the image. The only interactive component is a "Verify" button
 *     whose customId is `captcha_verify_${member.id}` — it carries NO code.
 *     The user types the code into a modal (see `buildCaptchaModal`) and
 *     `verifyCaptcha` compares server-side.
 *   • M-07 (Medium, Reliability): sessions are now persisted in the
 *     `captcha_sessions` table (PK `(guild_id, user_id)`) instead of an
 *     in-memory Map, so they survive restarts. A best-effort setTimeout still
 *     kicks timed-out members; `expireStaleCaptchaSessions` is the source of
 *     truth that runs from the ready handler.
 */
export async function startCaptcha(member: GuildMember): Promise<void> {
  const config = await getCaptchaConfig(member.guild.id);
  if (!config.enabled || !config.channel_id) return;

  const channel = member.guild.channels.cache.get(config.channel_id) as TextChannel | undefined;
  if (!channel) return;

  const code = generateCaptchaCode(config.difficulty);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.timeout);

  const { error } = await supabase.from("captcha_sessions").upsert({
    guild_id: member.guild.id,
    user_id: member.id,
    code,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    verified: false,
  });
  if (error) {
    console.error("[captcha] Failed to persist session:", error);
    return;
  }

  const imageBuffer = renderCaptchaImage(code);

  const verifyButton = new ButtonBuilder()
    .setCustomId(`captcha_verify_${member.id}`)
    .setLabel("Verify")
    .setStyle(ButtonStyle.Success)
    .setEmoji("✅");
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(verifyButton);

  await channel.send({
    content: `🔐 ${member}, please complete the captcha to verify you're human. Click **Verify** and type the code shown in the image.`,
    files: [{ attachment: imageBuffer, name: "captcha.png" }],
    components: [row],
  });

  // Best-effort in-memory timeout. The DB is the source of truth —
  // `expireStaleCaptchaSessions` (called from the ready handler) will catch
  // any sessions that this timer misses (e.g. after a restart).
  setTimeout(async () => {
    try {
      const session = await getCaptchaSession(member.id, member.guild.id);
      if (!session || session.verified) return;
      if (new Date(session.expires_at).getTime() > Date.now()) return;
      await supabase
        .from("captcha_sessions")
        .delete()
        .eq("guild_id", member.guild.id)
        .eq("user_id", member.id);
      await member.kick("Captcha verification timeout").catch(() => {});
    } catch (err) {
      console.error("[captcha] Timeout cleanup failed:", err);
    }
  }, config.timeout);
}

/**
 * Build the modal shown when the user clicks the "Verify" button on a captcha
 * message. The modal's customId is `captcha_submit_${userId}`; the
 * orchestrator's interactionCreate handles that submit by calling
 * `verifyCaptcha(userId, guildId, input)`.
 */
export function buildCaptchaModal(userId: string): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`captcha_submit_${userId}`)
    .setTitle("Captcha Verification");

  const codeInput = new TextInputBuilder()
    .setCustomId("captcha_code_input")
    .setLabel("Type the code shown above")
    .setPlaceholder("Enter the code from the image")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(10);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(codeInput);
  modal.addComponents(row);
  return modal;
}

/**
 * Read a persisted captcha session for a given guild+user. Returns `null` when
 * no session exists (e.g., already verified, never started, or expired and
 * purged).
 */
export async function getCaptchaSession(
  userId: string,
  guildId: string
): Promise<CaptchaSession | null> {
  const { data } = await supabase
    .from("captcha_sessions")
    .select("*")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as CaptchaSession | null) ?? null;
}

/**
 * Verify a user's typed captcha code against the persisted session.
 *
 * On success: grants the configured `role_id` (if any) and DELETES the
 * session row (so the PK stays free for a future re-captcha).
 * On failure: returns `false` and leaves the session in place (so the user can
 * retry without re-triggering `startCaptcha`).
 *
 * The shared `client` (from `src/client.ts`) is used to fetch the guild and
 * member for the role grant — this keeps the function signature
 * `verifyCaptcha(userId, guildId, input)` intact.
 */
export async function verifyCaptcha(
  userId: string,
  guildId: string,
  input: string
): Promise<boolean> {
  const session = await getCaptchaSession(userId, guildId);
  if (!session) return false;
  if (session.verified) return true;

  if (input.trim().toUpperCase() !== session.code.toUpperCase()) {
    return false;
  }

  // Success: grant role + delete session.
  const config = await getCaptchaConfig(guildId);
  if (config.role_id) {
    try {
      const guild = await client.guilds.fetch(guildId);
      const member = await guild.members.fetch(userId);
      if (member && !member.roles.cache.has(config.role_id)) {
        await member.roles.add(config.role_id, "Captcha verified");
      }
    } catch (err) {
      console.error("[captcha] Failed to grant verified role:", err);
      // Don't fail the verification just because the role grant failed —
      // the user typed the correct code. The session is still deleted below.
    }
  }

  await supabase
    .from("captcha_sessions")
    .delete()
    .eq("guild_id", guildId)
    .eq("user_id", userId);

  return true;
}

/**
 * Poll the DB for expired, unverified captcha sessions and kick the
 * associated members. Intended to be called from the ready handler on an
 * interval (e.g. every 60s) so that sessions started shortly before a
 * restart still get cleaned up.
 *
 * This is the source of truth for "captcha timeout" kicks; the per-session
 * setTimeout in `startCaptcha` is best-effort only.
 */
export async function expireStaleCaptchaSessions(client: Client): Promise<void> {
  const { data, error } = await supabase
    .from("captcha_sessions")
    .select("*")
    .lt("expires_at", new Date().toISOString())
    .eq("verified", false);

  if (error) {
    console.error("[captcha] Failed to fetch stale sessions:", error);
    return;
  }
  if (!data || data.length === 0) return;

  for (const row of data as CaptchaSession[]) {
    try {
      const guild = client.guilds.cache.get(row.guild_id);
      if (!guild) continue;
      const member = await guild.members.fetch(row.user_id).catch(() => null);
      if (member) {
        await member.kick("Captcha verification timeout").catch(() => {});
      }
    } catch (err) {
      console.error(`[captcha] Failed to kick expired member ${row.user_id} in ${row.guild_id}:`, err);
    } finally {
      await supabase
        .from("captcha_sessions")
        .delete()
        .eq("guild_id", row.guild_id)
        .eq("user_id", row.user_id);
    }
  }
}
