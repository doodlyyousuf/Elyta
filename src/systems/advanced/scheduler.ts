
import { supabase } from "../../database/supabase.js";

export async function checkScheduledAnnouncements(client: any) {
  const { data: announcements } = await supabase
    .from("scheduled_announcements")
    .select("*")
    .eq("sent", false)
    .lte("scheduled_at", new Date().toISOString());

  if (!announcements) return;

  for (const announcement of announcements) {
    try {
      const channel = await client.channels.fetch(announcement.channel_id).catch(() => null);
      if (channel) {
        await channel.send(announcement.message);
      }

      await supabase.from("scheduled_announcements").update({ sent: true }).eq("id", announcement.id);
    } catch (error) {
      console.error("Error sending scheduled announcement:", error);
    }
  }
}
