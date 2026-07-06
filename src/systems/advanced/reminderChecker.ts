import { supabase } from "../../database/supabase.js";

export async function checkReminders(client: any) {
  const { data: reminders } = await supabase
    .from("reminders")
    .select("*")
    .eq("sent", false)
    .lte("remind_at", new Date().toISOString());

  if (!reminders) return;

  for (const reminder of reminders) {
    try {
      const user = await client.users.fetch(reminder.user_id).catch(() => null);
      if (user) {
        await user.send(`⏰ **Reminder:** ${reminder.message}`).catch(() => {});
      }

      await supabase.from("reminders").update({ sent: true }).eq("id", reminder.id);
    } catch (error) {
      console.error("Error sending reminder:", error);
    }
  }
}
