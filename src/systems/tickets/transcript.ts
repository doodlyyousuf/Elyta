export async function generateTranscript(channel: any, ticket: any): Promise<string> {
  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = [...messages.values()].sort((a: any, b: any) => a.createdTimestamp - b.createdTimestamp);

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Transcript #${ticket.id}</title>
<style>body{font-family:sans-serif;background:#36393f;color:#dcddde;padding:20px}
.msg{margin:8px 0;padding:8px;background:#2f3136;border-radius:4px}
.author{font-weight:bold;color:#fff}.time{color:#72767d;font-size:12px}
.attach{color:#00aff4}</style></head><body>`;
  html += `<h1>Ticket #${ticket.id}</h1>`;
  html += `<p>User: ${ticket.user_id} | Category: ${ticket.category || "support"} | Claimed: ${ticket.claimed_by || "none"}</p><hr>`;

  for (const msg of sorted) {
    if (msg.author.bot && msg.author.id === channel.client.user.id && !msg.content) continue;
    const time = new Date(msg.createdTimestamp).toISOString();
    html += `<div class="msg"><span class="author">${msg.author.tag}</span> <span class="time">${time}</span><br>`;
    html += msg.content ? msg.content.replace(/</g, "&lt;") : "";
    for (const att of msg.attachments.values()) {
      html += `<br><span class="attach">📎 ${att.name} — ${att.url}</span>`;
    }
    html += `</div>`;
  }
  html += `</body></html>`;
  return html;
}
