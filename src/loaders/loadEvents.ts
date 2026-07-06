import { readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { client } from "../client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function loadEvents() {
  const eventsPath = join(__dirname, "../events");
  const files = readdirSync(eventsPath).filter((f) => f.endsWith(".ts") || f.endsWith(".js"));

  for (const file of files) {
    const mod = await import(`../events/${file}`);
    const event = mod.default;
    if (!event?.name || !event?.execute) continue;
    if (event.once) {
      client.once(event.name, (...args: any[]) => event.execute(...args));
    } else {
      client.on(event.name, (...args: any[]) => event.execute(...args));
    }
    console.log(`📌 Loaded event: ${event.name}`);
  }
}
