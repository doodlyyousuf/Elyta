
import { AttachmentBuilder } from "discord.js";
import { supabase } from "../../database/supabase.js";

export async function archiveTicketImages(channel: any, ticketId: number, guild: any) {
  let imageChannel = guild.channels.cache.find((c: any) => c.name === "ticket-images");
  if (!imageChannel) {
    imageChannel = await guild.channels.create({ name: "ticket-images", topic: "Archived ticket images" });
  }

  const messages = await channel.messages.fetch({ limit: 100 });
  for (const msg of messages.values()) {
    for (const att of msg.attachments.values()) {
      if (!att.contentType?.startsWith("image/")) continue;
      try {
        const res = await fetch(att.url);
        const buf = Buffer.from(await res.arrayBuffer());
        const file = new AttachmentBuilder(buf, { name: att.name || "image.png" });
        const sent = await imageChannel.send({
          content: `Ticket #${ticketId} | ${msg.author.tag} | ${att.name}`,
          files: [file],
        });
        const archivedUrl = sent.attachments.first()?.url || att.url;
        await supabase.from("ticket_images").insert({
          ticket_id: ticketId,
          original_url: att.url,
          archived_url: archivedUrl,
          file_name: att.name,
        });
      } catch (e) {
        console.error("Failed to archive image:", e);
      }
    }
  }
}
