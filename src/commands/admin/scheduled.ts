
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from "discord.js";
import { supabase } from "../../database/supabase.js";

export interface ScheduledMessage {
  id: string;
  guild_id: string;
  channel_id: string;
  message: string;
  title?: string;
  scheduled_at: string;
  created_by: string;
  status: "pending" | "sent" | "cancelled";
}

export default {
  data: new SlashCommandBuilder()
    .setName("scheduled")
    .setDescription("Manage scheduled messages")
    .addSubcommand(subcommand =>
      subcommand
        .setName("create")
        .setDescription("Schedule a message")
        .addChannelOption(option =>
          option
            .setName("channel")
            .setDescription("Channel to send to")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName("message")
            .setDescription("Message content")
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName("time")
            .setDescription("Time to send (ISO format: YYYY-MM-DDTHH:mm:ss)")
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName("title")
            .setDescription("Message title (for embed)")
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("list")
        .setDescription("List scheduled messages")
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("cancel")
        .setDescription("Cancel a scheduled message")
        .addStringOption(option =>
          option
            .setName("id")
            .setDescription("Message ID to cancel")
            .setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction: any) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "create") {
      const channel = interaction.options.getChannel("channel");
      const message = interaction.options.getString("message");
      const title = interaction.options.getString("title");
      const time = interaction.options.getString("time");

      try {
        const scheduledTime = new Date(time);
        if (scheduledTime <= new Date()) {
          return interaction.editReply({
            content: "❌ Scheduled time must be in the future.",
            ephemeral: true,
          });
        }

        const { data, error } = await supabase
          .from("scheduled_messages")
          .insert({
            guild_id: interaction.guildId,
            channel_id: channel.id,
            message,
            title,
            scheduled_at: scheduledTime.toISOString(),
            created_by: interaction.user.id,
            status: "pending",
          })
          .select()
          .single();

        if (error) throw error;

        await interaction.editReply(`✅ Message scheduled for ${scheduledTime.toISOString()} (ID: ${data.id})`);
      } catch (error) {
        await interaction.editReply({
          content: "❌ Failed to schedule message.",
          ephemeral: true,
        });
      }
    } else if (subcommand === "list") {
      try {
        const { data, error } = await supabase
          .from("scheduled_messages")
          .select("*")
          .eq("guild_id", interaction.guildId)
          .eq("status", "pending")
          .order("scheduled_at", { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
          return interaction.editReply("No pending scheduled messages.");
        }

        const list = data.map((msg: ScheduledMessage) => 
          `**ID:** ${msg.id}\n**Time:** <t:${Math.floor(new Date(msg.scheduled_at).getTime() / 1000)}:R>\n**Channel:** <#${msg.channel_id}>\n**Message:** ${msg.message.slice(0, 50)}...`
        ).join("\n\n");

        await interaction.editReply(`📅 **Scheduled Messages:**\n\n${list}`);
      } catch (error) {
        await interaction.editReply({
          content: "❌ Failed to fetch scheduled messages.",
          ephemeral: true,
        });
      }
    } else if (subcommand === "cancel") {
      const id = interaction.options.getString("id");

      try {
        const { error } = await supabase
          .from("scheduled_messages")
          .update({ status: "cancelled" })
          .eq("id", id)
          .eq("guild_id", interaction.guildId);

        if (error) throw error;

        await interaction.editReply("✅ Scheduled message cancelled.");
      } catch (error) {
        await interaction.editReply({
          content: "❌ Failed to cancel message.",
          ephemeral: true,
        });
      }
    }
  },
};
