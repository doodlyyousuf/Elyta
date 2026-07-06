/**
 * Express dashboard server — corrected (C-01, C-08, H-06, M-10, M-11).
 *
 *  • C-01  Every `/api/guild/:id/*` route now passes through `requireGuildAdmin`,
 *          which cross-checks the `:id` against the logged-in user's guilds
 *          (filtered to `permissions & 0x8 === 0x8`) AND re-verifies the bot is
 *          in the guild via the Discord API. The DELETE blacklist route is
 *          protected too. Previously `requireAuth` only checked a session
 *          existed — any logged-in user could read any guild's data (IDOR).
 *  • C-08  Uses the single shared Supabase client (service key) instead of
 *          creating its own.
 *  • H-06  OAuth now sends a random `state`, verifies it on callback, requires a
 *          strong SESSION_SECRET (enforced in src/lib/env.ts), sets
 *          `secure`+`sameSite:lax` cookies, and stores+uses a refresh_token.
 *  • M-10  express-rate-limit is applied to auth and API routes.
 *  • M-11  Discord user profiles are cached (id → {username, avatar}) with a
 *          TTL to eliminate N+1 API calls on tickets/blacklist/warnings lists.
 */
import express from "express";
import session from "express-session";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { supabase } from "../database/supabase.js";
import { env } from "../lib/env.js";
import { log } from "../lib/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "../..");

declare module "express-session" {
  interface SessionData {
    user: {
      id: string;
      username: string;
      discriminator: string;
      avatar: string | null;
      accessToken: string;
      refreshToken?: string;
      guilds: Array<{ id: string; name: string; icon: string | null; permissions: string }>;
    };
    oauthState?: string;
  }
}

const DISCORD_API = "https://discord.com/api/v10";
const ADMIN_PERMISSION_BIT = 0x8;
const USER_PROFILE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function startDashboard() {
  const e = env();
  const discordClientId = process.env.DISCORD_CLIENT_ID || e.DISCORD_CLIENT_ID || "";
  const discordClientSecret = process.env.DISCORD_CLIENT_SECRET || e.DISCORD_CLIENT_SECRET || "";
  const botToken = process.env.DISCORD_TOKEN || "";
  const sessionSecret = e.SESSION_SECRET;
  const port = e.WEB_PORT;
  const webUrl = e.WEB_URL || `http://localhost:${port}`;
  const isProd = e.NODE_ENV === "production";

  if (!discordClientId || !discordClientSecret || !botToken) {
    log.warn("Dashboard disabled: DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET / DISCORD_TOKEN not set");
    return;
  }

  const app = express();
  const DISCORD_REDIRECT_URI = `${webUrl}/auth/callback`;

  // ── Session (H-06: secure cookies, strong secret, sameSite) ───────────────
  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
      },
    })
  );

  // ── Rate limiting (M-10) ──────────────────────────────────────────────────
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please slow down." },
  });
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many auth attempts, please slow down." },
  });
  app.use("/api/", apiLimiter);
  app.use("/auth/", authLimiter);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction): void {
    if (!req.session.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    next();
  }

  /**
   * C-01: require that the logged-in user is an administrator (ManageGuild /
   * 0x8) of the guild named by `:id`, and that the bot is actually in that
   * guild. Applied to EVERY `/api/guild/:id/*` route including DELETE.
   */
  function requireGuildAdmin(req: express.Request, res: express.Response, next: express.NextFunction): void {
    const user = req.session.user;
    const guildId = req.params.id;
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const guild = user.guilds.find((g) => g.id === guildId);
    if (!guild || (parseInt(guild.permissions) & ADMIN_PERMISSION_BIT) !== ADMIN_PERMISSION_BIT) {
      res.status(403).json({ error: "You are not an administrator of this guild" });
      return;
    }
    next();
  }

  // Re-verify the bot is in the guild (belt-and-suspenders). Applied as an
  // async middleware on data routes so a stale session cannot leak data for a
  // guild the bot has since left.
  async function verifyBotInGuild(req: express.Request, res: express.Response, next: express.NextFunction) {
    try {
      await botApi(`/guilds/${req.params.id}`);
      next();
    } catch {
      res.status(404).json({ error: "Guild not found or bot is not a member" });
    }
  }

  function getUser(req: express.Request) {
    return req.session.user!;
  }

  async function botApi(endpoint: string) {
    const r = await fetch(`${DISCORD_API}${endpoint}`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (!r.ok) throw new Error(`Discord API ${r.status}`);
    return r.json();
  }

  async function userApi(endpoint: string, token: string) {
    const r = await fetch(`${DISCORD_API}${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.status === 401 && reqSessionHasRefresh()) {
      // H-06: refresh once on a 401 and retry.
      throw new Error("TOKEN_EXPIRED");
    }
    if (!r.ok) throw new Error(`Discord API ${r.status}`);
    return r.json();
  }

  // Thin indirection so userApi can trigger a refresh via the active request's
  // session. Kept simple to avoid threading the session through every call.
  let _activeReq: express.Request | null = null;
  function reqSessionHasRefresh() {
    return Boolean(_activeReq?.session.user?.refreshToken);
  }

  // M-11: in-memory user-profile cache (id → { username, avatar, expires })
  const userProfileCache = new Map<string, { username: string; avatar: string | null; expires: number }>();

  async function getCachedUser(uid: string): Promise<{ username: string; avatar: string | null }> {
    const hit = userProfileCache.get(uid);
    if (hit && hit.expires > Date.now()) {
      return { username: hit.username, avatar: hit.avatar };
    }
    try {
      const u = await botApi(`/users/${uid}`);
      const entry = { username: u.username || uid, avatar: u.avatar || null, expires: Date.now() + USER_PROFILE_TTL_MS };
      userProfileCache.set(uid, entry);
      return { username: entry.username, avatar: entry.avatar };
    } catch {
      return { username: uid, avatar: null };
    }
  }

  async function refreshAccessToken(req: express.Request): Promise<string | null> {
    const refreshToken = req.session.user?.refreshToken;
    if (!refreshToken) return null;
    try {
      const tokenRes: any = await fetch(`${DISCORD_API}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: discordClientId,
          client_secret: discordClientSecret,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      }).then((r) => r.json());

      if (!tokenRes.access_token) return null;
      req.session.user!.accessToken = tokenRes.access_token;
      if (tokenRes.refresh_token) req.session.user!.refreshToken = tokenRes.refresh_token;
      return tokenRes.access_token;
    } catch {
      return null;
    }
  }

  // ── Auth Routes ───────────────────────────────────────────────────────────
  app.get("/auth/login", (req, res) => {
    // H-06: generate + store a random state, verify on callback (CSRF protection)
    const state = crypto.randomBytes(16).toString("hex");
    req.session.oauthState = state;

    const params = new URLSearchParams({
      client_id: discordClientId,
      redirect_uri: DISCORD_REDIRECT_URI,
      response_type: "code",
      scope: "identify guilds",
      state,
    });
    res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
  });

  app.get("/auth/callback", async (req, res) => {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;

    // H-06: verify the state to prevent CSRF on the OAuth callback.
    if (!code || !state || state !== req.session.oauthState) {
      return res.redirect("/auth/login");
    }
    req.session.oauthState = undefined;

    try {
      const tokenRes: any = await fetch(`${DISCORD_API}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: discordClientId,
          client_secret: discordClientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: DISCORD_REDIRECT_URI,
        }),
      }).then((r) => r.json());

      if (!tokenRes.access_token) return res.redirect("/auth/login");

      const [user, guilds] = await Promise.all([
        userApi("/users/@me", tokenRes.access_token),
        userApi("/users/@me/guilds", tokenRes.access_token),
      ]);

      req.session.user = {
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
        avatar: user.avatar,
        accessToken: tokenRes.access_token,
        refreshToken: tokenRes.refresh_token, // H-06: store refresh token
        guilds,
      };

      res.redirect("/");
    } catch {
      res.redirect("/auth/login");
    }
  });

  app.get("/auth/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/"));
  });

  // ── API: Current User ─────────────────────────────────────────────────────
  app.get("/api/user", requireAuth, (req, res) => {
    const u = getUser(req);
    res.json({ id: u.id, username: u.username, discriminator: u.discriminator, avatar: u.avatar });
  });

  // ── API: Guilds ───────────────────────────────────────────────────────────
  app.get("/api/guilds", requireAuth, async (req, res) => {
    _activeReq = req;
    try {
      const user = getUser(req);
      let freshGuilds = user.guilds;
      try {
        freshGuilds = await userApi("/users/@me/guilds", user.accessToken);
        req.session.user!.guilds = freshGuilds;
      } catch (err: any) {
        if (err.message === "TOKEN_EXPIRED") {
          const refreshed = await refreshAccessToken(req);
          if (refreshed) {
            freshGuilds = await userApi("/users/@me/guilds", refreshed);
            req.session.user!.guilds = freshGuilds;
          }
        }
      }

      const adminGuilds = freshGuilds.filter((g) => (parseInt(g.permissions) & ADMIN_PERMISSION_BIT) === ADMIN_PERMISSION_BIT);
      const managed: Array<{ id: string; name: string; icon: string | null; memberCount: number; onlineCount: number }> = [];

      for (let i = 0; i < adminGuilds.length; i += 10) {
        const batch = adminGuilds.slice(i, i + 10);
        const results = await Promise.allSettled(batch.map((g) => botApi(`/guilds/${g.id}?with_counts=true`)));
        results.forEach((r) => {
          if (r.status === "fulfilled" && r.value.id) {
            managed.push({
              id: r.value.id,
              name: r.value.name,
              icon: r.value.icon,
              memberCount: r.value.approximate_member_count ?? 0,
              onlineCount: r.value.approximate_presence_count ?? 0,
            });
          }
        });
      }
      res.json(managed);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    } finally {
      _activeReq = null;
    }
  });

  // ── API: Guild Stats ──────────────────────────────────────────────────────
  app.get("/api/guild/:id/stats", requireAuth, requireGuildAdmin, verifyBotInGuild, async (req, res) => {
    try {
      const { id } = req.params;
      const [ticketsRes, activeTicketsRes, giveawaysRes, warningsRes, guildData] = await Promise.all([
        supabase.from("tickets").select("*", { count: "exact", head: true }).eq("guild_id", id),
        supabase.from("tickets").select("*", { count: "exact", head: true }).eq("guild_id", id).eq("status", "open"),
        supabase.from("giveaways").select("*", { count: "exact", head: true }).eq("guild_id", id).eq("ended", false),
        supabase.from("warnings").select("*", { count: "exact", head: true }).eq("guild_id", id),
        botApi(`/guilds/${id}?with_counts=true`),
      ]);
      res.json({
        totalTickets: ticketsRes.count || 0,
        activeTickets: activeTicketsRes.count || 0,
        totalMembers: guildData.approximate_member_count || 0,
        onlineMembers: guildData.approximate_presence_count || 0,
        activeGiveaways: giveawaysRes.count || 0,
        totalWarnings: warningsRes.count || 0,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── API: Guild Tickets ────────────────────────────────────────────────────
  app.get("/api/guild/:id/tickets", requireAuth, requireGuildAdmin, verifyBotInGuild, async (req, res) => {
    try {
      const { id } = req.params;
      const { data: tickets, error } = await supabase
        .from("tickets")
        .select("*")
        .eq("guild_id", id)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;

      const ticketsList = tickets || [];
      const allIds = [...new Set([
        ...ticketsList.map((t: any) => t.user_id),
        ...ticketsList.map((t: any) => t.claimed_by).filter(Boolean),
      ])] as string[];

      // M-11: batch via cache instead of N+1 raw API calls
      const profiles = new Map<string, { username: string; avatar: string | null }>();
      await Promise.allSettled(
        allIds.map(async (uid) => profiles.set(uid, await getCachedUser(uid)))
      );

      const enriched = ticketsList.map((t: any) => ({
        ...t,
        username: profiles.get(t.user_id)?.username || t.user_id,
        user_avatar: profiles.get(t.user_id)?.avatar,
        claimed_by_name: t.claimed_by ? profiles.get(t.claimed_by)?.username || t.claimed_by : null,
      }));
      res.json({ tickets: enriched });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── API: Blacklist ────────────────────────────────────────────────────────
  app.get("/api/guild/:id/blacklist", requireAuth, requireGuildAdmin, verifyBotInGuild, async (req, res) => {
    try {
      const { id } = req.params;
      const { data: entries, error } = await supabase
        .from("blacklist")
        .select("*")
        .eq("guild_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const list = entries || [];
      const allIds = [...new Set([
        ...list.map((e: any) => e.user_id),
        ...list.map((e: any) => e.added_by),
      ])].filter(Boolean) as string[];

      const profiles = new Map<string, { username: string; avatar: string | null }>();
      await Promise.allSettled(allIds.map(async (uid) => profiles.set(uid, await getCachedUser(uid))));

      const enriched = list.map((e: any) => ({
        ...e,
        username: profiles.get(e.user_id)?.username || e.user_id,
        user_avatar: profiles.get(e.user_id)?.avatar,
        added_by_name: profiles.get(e.added_by)?.username || e.added_by,
        added_by_avatar: profiles.get(e.added_by)?.avatar,
      }));
      res.json({ blacklist: enriched });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // C-01: DELETE is now protected by requireGuildAdmin + verifyBotInGuild too.
  app.delete("/api/guild/:id/blacklist/:userId", requireAuth, requireGuildAdmin, verifyBotInGuild, async (req, res) => {
    try {
      const { id, userId } = req.params;
      const { error } = await supabase
        .from("blacklist")
        .delete()
        .eq("guild_id", id)
        .eq("user_id", userId);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── API: Warnings ─────────────────────────────────────────────────────────
  app.get("/api/guild/:id/warnings", requireAuth, requireGuildAdmin, verifyBotInGuild, async (req, res) => {
    try {
      const { id } = req.params;
      const { data: entries, error } = await supabase
        .from("warnings")
        .select("*")
        .eq("guild_id", id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      const list = entries || [];
      const allIds = [...new Set([
        ...list.map((e: any) => e.user_id),
        ...list.map((e: any) => e.moderator_id),
      ])].filter(Boolean) as string[];

      const profiles = new Map<string, { username: string; avatar: string | null }>();
      await Promise.allSettled(allIds.map(async (uid) => profiles.set(uid, await getCachedUser(uid))));

      const enriched = list.map((e: any) => ({
        ...e,
        username: profiles.get(e.user_id)?.username || e.user_id,
        user_avatar: profiles.get(e.user_id)?.avatar,
        moderator_name: profiles.get(e.moderator_id)?.username || e.moderator_id,
        moderator_avatar: profiles.get(e.moderator_id)?.avatar,
      }));
      res.json({ warnings: enriched });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── API: Generic table read (also guild-admin guarded) ─────────────────────
  const ALLOWED_TABLES = new Set(["giveaways", "guild_settings", "invite_tracking", "filtered_words", "smp_orders", "ticket_attachments"]);
  app.get("/api/guild/:id/table/:table", requireAuth, requireGuildAdmin, verifyBotInGuild, async (req, res) => {
    const table = req.params.table;
    if (!table || !ALLOWED_TABLES.has(table)) return res.status(403).json({ error: "Table not allowed" });
    try {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("guild_id", req.params.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── API: Guild Members ────────────────────────────────────────────────────
  app.get("/api/guild/:id/members", requireAuth, requireGuildAdmin, verifyBotInGuild, async (req, res) => {
    try {
      const guildData: any = await botApi(`/guilds/${req.params.id}?with_counts=true`);
      const members: any = await botApi(`/guilds/${req.params.id}/members?limit=100`);

      const enrichedMembers = await Promise.allSettled(
        members.map(async (member: any) => {
          const u = await getCachedUser(member.user.id);
          return {
            id: member.user.id,
            username: u.username || member.user.username,
            discriminator: member.user.discriminator,
            avatar: u.avatar || member.user.avatar,
            joined_at: member.joined_at,
            roles: member.roles,
            nick: member.nick,
          };
        })
      );
      res.json({
        totalMembers: guildData.approximate_member_count || 0,
        members: enrichedMembers.filter((r: any) => r.status === "fulfilled").map((r: any) => r.value),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── API: User Profile ──────────────────────────────────────────────────────
  app.get("/api/guild/:id/user/:userId", requireAuth, requireGuildAdmin, verifyBotInGuild, async (req, res) => {
    try {
      const { userId, id: guildId } = req.params;
      const user: any = await botApi(`/users/${userId}`);
      const { data: warnings } = await supabase
        .from("warnings")
        .select("*")
        .eq("user_id", userId)
        .eq("guild_id", guildId)
        .order("created_at", { ascending: false })
        .limit(10);
      const { data: tickets } = await supabase
        .from("tickets")
        .select("*")
        .eq("user_id", userId)
        .eq("guild_id", guildId)
        .order("created_at", { ascending: false })
        .limit(10);
      res.json({
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
        avatar: user.avatar,
        banner: user.banner,
        accent_color: user.accent_color,
        public_flags: user.public_flags,
        warnings: warnings || [],
        tickets: tickets || [],
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Serve static + catch-all ──────────────────────────────────────────────
  app.use(express.static(path.join(projectRoot, "public")));

  const requireSession = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.session.user) return res.redirect("/auth/login");
    next();
  };

  app.get("/", requireSession, (_req, res) => res.sendFile(path.join(projectRoot, "public", "dashboard.html")));
  app.get("/tickets", requireSession, (_req, res) => res.sendFile(path.join(projectRoot, "public", "tickets.html")));
  app.get("/members", requireSession, (_req, res) => res.sendFile(path.join(projectRoot, "public", "members.html")));
  app.get("/giveaways", requireSession, (_req, res) => res.sendFile(path.join(projectRoot, "public", "giveaways.html")));
  app.get("/warnings", requireSession, (_req, res) => res.sendFile(path.join(projectRoot, "public", "warnings.html")));
  app.get("/blacklist", requireSession, (_req, res) => res.sendFile(path.join(projectRoot, "public", "blacklist.html")));
  app.get("/settings", requireSession, (_req, res) => res.sendFile(path.join(projectRoot, "public", "settings.html")));

  app.use((_req, res) => res.redirect("/"));

  app.listen(port, () => log.info("Dashboard running", { url: `http://localhost:${port}` }));
}
