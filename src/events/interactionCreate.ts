/**
 * Interaction dispatcher — corrected (C-03, C-10, H-01, H-09, L-07, +captcha wiring).
 *
 *  • C-10  No longer forces `Ephemeral` on every deferReply. Each command may
 *          declare `ephemeral?: boolean`; defaults to public (false).
 *  • H-01  Cooldown is set AFTER successful execution, and the duration is read
 *          from the command module (`cmd.cooldownMs ?? DEFAULT_COOLDOWN_MS`).
 *          Failed commands do not apply a cooldown.
 *  • C-03  Music commands receive the client so they can read `client.distube`.
 *  • H-09  The role-button handler guards against DM / partial member.
 *  • L-07  Uses distinct customId prefixes (`ticket_priority_select_` for the
 *          category→priority select, vs the old overloaded `ticket_priority_`).
 *  • Captcha wiring: the `captcha_verify_` button shows a modal; the
 *          `captcha_submit_` modal calls `verifyCaptcha` (previously dead code).
 */
import type {
  Interaction,
  ChatInputCommandInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  GuildMember,
  MessageFlags,
} from "discord.js";
import { ChannelType, PermissionsBitField } from "discord.js";
import { commands } from "../handlers/loadCommands.js";
import { createTicket } from "../systems/tickets/create.js";
import { closeTicket, executeClose } from "../systems/tickets/close.js";
import { claimTicket } from "../systems/tickets/claim.js";
import { releaseTicket } from "../systems/tickets/release.js";
import { reopenTicket } from "../systems/tickets/reopen.js";
import {
  getCategoryFromCustomId,
  getCategoryButtons,
  prioritySelectCustomId,
  parsePrioritySelectCategory,
} from "../systems/tickets/categories.js";
import { getOrCreateTicketCategory } from "../systems/tickets/categoryChannel.js";
import { supabase } from "../database/supabase.js";
import { addStaffNote } from "../systems/tickets/staffNotes.js";
import { submitTicketRating } from "../systems/tickets/ratings.js";
import { updateTicketPriority } from "../systems/tickets/priority.js";
import { isBlacklisted } from "../systems/security/blacklist.js";
import { getCooldown, setCooldown } from "../systems/security/cooldowns.js";
import { buildCaptchaModal, verifyCaptcha } from "../systems/captcha/captcha.js";
import { ECONOMY } from "../config.js";
import { log } from "../lib/logger.js";

/** Translate role-management Discord API errors into actionable user guidance. */
function explainRoleError(err: any): string {
  const code = err?.code;
  const msg = String(err?.message ?? "");
  if (code === 50013 || /Missing Permissions/i.test(msg)) {
    return "I lack the **Manage Roles** permission, or my role is **below** the role you're trying to toggle. Move my bot role above the target role in Server Settings → Roles, and make sure I have **Manage Roles**.";
  }
  if (code === 10011 || /Unknown Role/i.test(msg)) {
    return "That role no longer exists.";
  }
  if (code === 50001 || /Missing Access/i.test(msg)) {
    return "I don't have access to this channel or role.";
  }
  return `(${msg})`;
}

export default {
  name: "interactionCreate",
  async execute(interaction: Interaction) {
    try {
      if (interaction.isChatInputCommand()) {
        await handleCommand(interaction);
      } else if (interaction.isModalSubmit()) {
        await handleModal(interaction);
      } else if (interaction.isButton() || interaction.isStringSelectMenu()) {
        await handleComponent(interaction as ButtonInteraction | StringSelectMenuInteraction);
      }
    } catch (err: any) {
      log.error("interactionCreate handler threw", {
        error: err?.message,
        stack: err?.stack,
        customId: (interaction as any).customId,
      });
      // Best-effort user feedback if the interaction is still replyable.
      try {
        if ((interaction as any).isRepliable() && !(interaction as any).replied) {
          await (interaction as any).reply({
            content: "❌ Something went wrong handling that interaction.",
            flags: ["Ephemeral"] as MessageFlags[],
          });
        }
      } catch {
        /* ignore */
      }
    }
  },
};

async function handleCommand(interaction: ChatInputCommandInteraction) {
  const cmd = commands.get(interaction.commandName);

  // Blacklist check
  if (interaction.guild && (await isBlacklisted(interaction.guild.id, interaction.user.id))) {
    return interaction.reply({
      content: "❌ You are blacklisted from using this bot.",
      flags: ["Ephemeral"] as MessageFlags[],
    });
  }

  if (!cmd) {
    return interaction.reply({ content: "❌ Unknown command.", flags: ["Ephemeral"] as MessageFlags[] });
  }

  // Cooldown check (before execution)
  const remaining = getCooldown(interaction.commandName, interaction.user.id);
  if (remaining > 0) {
    return interaction.reply({
      content: `❌ Please wait ${Math.ceil(remaining / 1000)}s before using \`/${interaction.commandName}\` again.`,
      flags: ["Ephemeral"] as MessageFlags[],
    });
  }

  // C-10: defer with the command's declared visibility (default public).
  const ephemeral = cmd.ephemeral === true;
  await interaction.deferReply(ephemeral ? { flags: ["Ephemeral"] as MessageFlags[] } : undefined);

  try {
    log.info("command invoked", {
      command: interaction.commandName,
      user: interaction.user.tag,
      guild: interaction.guild?.name,
    });
    // C-03: pass the client so music commands can read client.distube.
    await cmd.execute(interaction, interaction.client);
    log.info("command completed", { command: interaction.commandName });

    // H-01: set the cooldown AFTER successful execution, using the per-command
    // duration (default 3s).
    setCooldown(interaction.commandName, interaction.user.id, cmd.cooldownMs ?? ECONOMY.DEFAULT_COOLDOWN_MS);
  } catch (err: any) {
    log.error("command failed", {
      command: interaction.commandName,
      error: err?.message,
      stack: err?.stack,
    });
    await interaction.editReply("❌ An error occurred while running that command.").catch(() => {});
    // H-01: do NOT apply the cooldown on failure.
  }
}

async function handleModal(interaction: ModalSubmitInteraction) {
  const modalId = interaction.customId;

  if (modalId.startsWith("close_reason_")) {
    await interaction.deferUpdate();
    const ticketId = parseInt(modalId.replace("close_reason_", ""), 10);
    if (isNaN(ticketId)) {
      return interaction.followUp({ content: "❌ Invalid ticket ID.", flags: ["Ephemeral"] as MessageFlags[] });
    }
    const reason = interaction.fields.getTextInputValue("close_reason_input") || "";
    return executeClose(interaction, ticketId, reason);
  }

  if (modalId.startsWith("staff_note_")) {
    await interaction.deferUpdate();
    const ticketId = parseInt(modalId.replace("staff_note_", ""), 10);
    if (isNaN(ticketId)) {
      return interaction.followUp({ content: "❌ Invalid ticket ID.", flags: ["Ephemeral"] as MessageFlags[] });
    }
    const note = interaction.fields.getTextInputValue("note_content") || "";
    return addStaffNote(interaction, ticketId, note);
  }

  // Captcha submission (C-02 wiring): modal customId is captcha_submit_<userId>
  if (modalId.startsWith("captcha_submit_")) {
    const userId = modalId.replace("captcha_submit_", "");
    const input = interaction.fields.getTextInputValue("captcha_code_input");
    if (!interaction.guild) {
      return interaction.reply({ content: "❌ Verification can only be completed in a server.", flags: ["Ephemeral"] as MessageFlags[] });
    }
    const ok = await verifyCaptcha(userId, interaction.guild.id, input);
    if (ok) {
      return interaction.reply({ content: "✅ You are verified! Welcome.", flags: ["Ephemeral"] as MessageFlags[] });
    }
    return interaction.reply({ content: "❌ Incorrect code. Please try again or you may be removed.", flags: ["Ephemeral"] as MessageFlags[] });
  }
}

async function handleComponent(interaction: ButtonInteraction | StringSelectMenuInteraction) {
  const id = interaction.customId;

  // --- Close button BEFORE deferUpdate (modal needs an undeferred interaction) ---
  if (id === "ticket_close" || id === "close_ticket") {
    return closeTicket(interaction);
  }

  // --- Captcha verify button → show modal (C-02 wiring) ---
  if (id.startsWith("captcha_verify_")) {
    const userId = id.replace("captcha_verify_", "");
    const modal = buildCaptchaModal(userId);
    return interaction.showModal(modal);
  }

  // --- Rating buttons (DM-sourced; defer normally) ---
  if (id.startsWith("ticket_rate_")) {
    const parts = id.split("_");
    const ticketId = parseInt(parts[2], 10);
    const stars = parseInt(parts[3], 10);
    if (isNaN(ticketId) || isNaN(stars)) return;
    return submitTicketRating(interaction, ticketId, stars);
  }

  // --- Generic deferUpdate for remaining buttons/selects ---
  await interaction.deferUpdate();

  // --- Role buttons (H-09: guard against DM / partial member) ---
  if (id.startsWith("role_")) {
    if (!interaction.guild) {
      return interaction.followUp({ content: "❌ Roles can only be toggled in a server.", flags: ["Ephemeral"] as MessageFlags[] });
    }
    const roleId = id.replace("role_", "");
    const role = interaction.guild.roles.cache.get(roleId);
    if (!role) return interaction.followUp({ content: "❌ Role not found.", flags: ["Ephemeral"] as MessageFlags[] });
    // Fetch a full member — interaction.member may be a partial API object.
    let member: GuildMember | null = null;
    try {
      member = await interaction.guild.members.fetch(interaction.user.id);
    } catch {
      member = null;
    }
    if (!member) {
      return interaction.followUp({ content: "❌ Could not resolve your membership.", flags: ["Ephemeral"] as MessageFlags[] });
    }
    if (member.roles.cache.has(roleId)) {
      try {
        await member.roles.remove(role);
      } catch (err: any) {
        return interaction.followUp({
          content: `❌ I couldn't remove that role. ${explainRoleError(err)}`,
          flags: ["Ephemeral"] as MessageFlags[],
        });
      }
    } else {
      try {
        await member.roles.add(role);
      } catch (err: any) {
        return interaction.followUp({
          content: `❌ I couldn't add that role. ${explainRoleError(err)}`,
          flags: ["Ephemeral"] as MessageFlags[],
        });
      }
    }
    return;
  }

  if (id === "ticket_create") {
    return interaction.followUp({
      content: "Select a category:",
      components: getCategoryButtons(),
      flags: ["Ephemeral"] as MessageFlags[],
    });
  }

  // Category selection → show the priority select (L-07: distinct prefix).
  const category = getCategoryFromCustomId(id);
  if (category) {
    const { StringSelectMenuBuilder, ActionRowBuilder } = await import("discord.js");
    const priorityMenu = new StringSelectMenuBuilder()
      .setCustomId(prioritySelectCustomId(category)) // ticket_priority_select_<category>
      .setPlaceholder("Select a priority level")
      .addOptions([
        { label: "Low", value: "low", emoji: "🟢", description: "Standard priority" },
        { label: "Medium", value: "medium", emoji: "🟡", description: "Important issue" },
        { label: "High", value: "high", emoji: "🔴", description: "Urgent issue" },
      ]);
    const row = new ActionRowBuilder().addComponents(priorityMenu);
    return interaction.followUp({
      content: `You selected **${category}**.\nNow, please select the priority level:`,
      components: [row],
      flags: ["Ephemeral"] as MessageFlags[],
    });
  }

  // Priority selection from the category flow (L-07: distinct prefix).
  const selectedCategory = parsePrioritySelectCategory(id);
  if (selectedCategory) {
    const priority = (interaction as StringSelectMenuInteraction).values?.[0] ?? "medium";
    return createTicket(interaction, selectedCategory, priority);
  }

  // Existing per-ticket priority select (priority_select_<ticketId>)
  if (id.startsWith("priority_select_")) {
    const ticketId = parseInt(id.replace("priority_select_", ""), 10);
    const newPriority = (interaction as StringSelectMenuInteraction).values?.[0] ?? "medium";
    if (isNaN(ticketId)) return interaction.followUp({ content: "❌ Invalid ticket ID.", flags: ["Ephemeral"] as MessageFlags[] });
    return updateTicketPriority(interaction, ticketId, newPriority);
  }

  if (id === "ticket_claim") return claimTicket(interaction);
  if (id === "ticket_release") return releaseTicket(interaction);

  if (id.startsWith("ticket_reopen_")) {
    const ticketId = parseInt(id.replace("ticket_reopen_", ""), 10);
    if (isNaN(ticketId)) return interaction.followUp({ content: "❌ Invalid ticket ID.", flags: ["Ephemeral"] as MessageFlags[] });
    return reopenTicket(interaction, ticketId);
  }

  // Legacy "create_ticket" button (inline channel creation)
  if (id === "create_ticket") {
    if (!interaction.guild) return;
    const guild = interaction.guild;
    const user = interaction.user;
    const parentId = await getOrCreateTicketCategory(guild);
    const channel = await guild.channels.create({
      name: `ticket-${user.id}`,
      type: ChannelType.GuildText,
      parent: parentId,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: interaction.client.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
      ],
    });
    await supabase.from("tickets").insert({ guild_id: guild.id, user_id: user.id, channel_id: channel.id, status: "open" });
    await channel.send(`<@${user.id}> Your ticket has been created.`);
    return interaction.followUp({ content: `✅ Ticket created: ${channel}`, flags: ["Ephemeral"] as MessageFlags[] });
  }
}
