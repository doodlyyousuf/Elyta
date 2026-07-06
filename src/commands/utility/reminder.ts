
import { SlashCommandBuilder } from "discord.js";
import { supabase } from "../../database/supabase.js";

export const data = new SlashCommandBuilder()
  .setName("reminder")
  .setDescription("Set a reminder for yourself")
  .addStringOption((o) => o.setName("message").setDescription("What to remind you about").setRequired(true))
  .addStringOption((o) => o.setName("time").setDescription("When to remind (e.g., 1h, 30m, 1d)").setRequired(true));

export async function execute(interaction: any) {
  const message = interaction.options.getString("message", true);
  const timeStr = interaction.options.getString("time", true);

  // Parse time string
  const timeMatch = timeStr.match(/^(\d+)([hmd])$/);
  if (!timeMatch) {
    return interaction.editReply("❌ Invalid time format. Use format like: 1h, 30m, 1d");
  }

  const amount = parseInt(timeMatch[1]);
  const unit = timeMatch[2];

  let ms = 0;
  switch (unit) {
    case "h":
      ms = amount * 60 * 60 * 1000;
      break;
    case "m":
      ms = amount * 60 * 1000;
      break;
    case "d":
      ms = amount * 24 * 60 * 60 * 1000;
      break;
  }

  const remindAt = new Date(Date.now() + ms);

  await supabase.from("reminders").insert({
    user_id: interaction.user.id,
    guild_id: interaction.guildId,
    message,
    remind_at: remindAt.toISOString(),
  });

  await interaction.editReply(`✅ I'll remind you in ${timeStr}!`);
}
