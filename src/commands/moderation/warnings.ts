
import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { supabase } from "../../database/supabase.js";

export const data = new SlashCommandBuilder()
  .setName("warnings")
  .setDescription("View warnings for a member")
  .addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction: any) {
  const user = interaction.options.getUser("user", true);
  const { data } = await supabase
    .from("warnings")
    .select("*")
    .eq("guild_id", interaction.guildId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!data?.length) return interaction.editReply(`✅ **${user.tag}** has no warnings.`);

  const lines = data.map((w: any, i: number) => `${i + 1}. ${w.reason} (<t:${Math.floor(new Date(w.created_at).getTime() / 1000)}:R>)`);
  const embed = new EmbedBuilder()
    .setTitle(`Warnings — ${user.tag}`)
    .setDescription(lines.join("\n").slice(0, 4000))
    .setColor(0xffaa00);
  await interaction.editReply({ embeds: [embed] });
}
