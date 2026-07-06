
/* ==========================================================================
   cus_dis_bot dashboard — application logic
   Preserves original API contract and behavior; adds icons, toasts and a
   confirm modal in place of native alert()/confirm().
   ========================================================================== */

const api = (p) => fetch(p, { credentials: "same-origin" }).then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e)));
const h = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const avatarURL = (id, hash) => hash ? `https://cdn.discordapp.com/avatars/${id}/${hash}.png?size=64` : `https://cdn.discordapp.com/embed/avatars/0.png`;

let guilds = [], currentGuild = null;

/* --------------------------------------------------------------------------
   Icon rendering (Lucide) — call after any innerHTML swap
   -------------------------------------------------------------------------- */
function icons() {
  if (window.lucide) window.lucide.createIcons();
}

/* --------------------------------------------------------------------------
   Toast notifications (replaces alert())
   -------------------------------------------------------------------------- */
function ensureToastStack() {
  let stack = document.getElementById("toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "toast-stack";
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }
  return stack;
}

function toast(message, type = "success") {
  const stack = ensureToastStack();
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  const icon = type === "error" ? "circle-alert" : "circle-check";
  el.innerHTML = `<i data-lucide="${icon}"></i><span>${h(message)}</span>`;
  stack.appendChild(el);
  icons();
  setTimeout(() => {
    el.classList.add("is-leaving");
    setTimeout(() => el.remove(), 260);
  }, 3600);
}

/* --------------------------------------------------------------------------
   Confirm modal (replaces confirm())
   -------------------------------------------------------------------------- */
function confirmModal({ title = "Are you sure?", body = "", confirmLabel = "Confirm", danger = true } = {}) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal-card" role="alertdialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-icon"><i data-lucide="triangle-alert"></i></div>
        <div class="modal-title" id="modal-title">${h(title)}</div>
        <div class="modal-body">${h(body)}</div>
        <div class="modal-actions">
          <button class="btn" data-action="cancel">Cancel</button>
          <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-action="confirm">${h(confirmLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    icons();

    const finish = (result) => { backdrop.remove(); document.removeEventListener("keydown", onKey); resolve(result); };
    const onKey = (e) => { if (e.key === "Escape") finish(false); };
    document.addEventListener("keydown", onKey);
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) finish(false); });
    backdrop.querySelector('[data-action="cancel"]').addEventListener("click", () => finish(false));
    backdrop.querySelector('[data-action="confirm"]').addEventListener("click", () => finish(true));
    backdrop.querySelector('[data-action="confirm"]').focus();
  });
}

/* --------------------------------------------------------------------------
   Nav configuration
   -------------------------------------------------------------------------- */
const NAV_ITEMS = [
  { page: "dashboard", href: "/",           label: "Dashboard", icon: "layout-dashboard" },
  { page: "tickets",   href: "/tickets",    label: "Tickets",   icon: "ticket" },
  { page: "warnings",  href: "/warnings",   label: "Warnings",  icon: "triangle-alert" },
  { page: "blacklist", href: "/blacklist",  label: "Blacklist", icon: "shield-ban" },
  { page: "members",   href: "/members",    label: "Members",   icon: "users" },
  { page: "giveaways", href: "/giveaways",  label: "Giveaways", icon: "gift" },
  { page: "settings",  href: "/settings",   label: "Settings",  icon: "settings" },
];

/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */
function renderNav() {
  const nav = document.getElementById("nav");
  if (!nav) return;
  nav.innerHTML = NAV_ITEMS.map(item =>
    `<a href="${item.href}" data-page="${item.page}"><i data-lucide="${item.icon}"></i><span class="label">${item.label}</span></a>`
  ).join("");
}

async function boot() {
  renderNav();
  icons();
  try {
    const user = await api("/api/user");
    document.getElementById("user-chip").classList.remove("hidden");
    document.getElementById("user-avatar").src = avatarURL(user.id, user.avatar);
    document.getElementById("user-name").textContent = user.username;
  } catch { /* not logged in — server will redirect to /auth/login */ return; }

  try { guilds = await api("/api/guilds"); } catch (e) { guilds = []; }
  if (guilds.length === 0) {
    renderNoGuilds(); return;
  }
  currentGuild = localStorage.getItem("selectedGuild") || guilds[0].id;
  if (!guilds.find(g => g.id === currentGuild)) currentGuild = guilds[0].id;

  const page = document.body.dataset.page || (location.pathname === "/" ? "dashboard" : location.pathname.slice(1));
  markNav(page);
  await renderPage(page);
}

function markNav(page) {
  document.querySelectorAll("#nav a").forEach(a => {
    const isActive = a.dataset.page === page;
    a.classList.toggle("active", isActive);
    if (isActive) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
}

function renderNoGuilds() {
  document.getElementById("main").innerHTML = `
    <div class="page-title"><span class="icon-badge"><i data-lucide="server-off"></i></span>No managed servers</div>
    <div class="page-sub">The bot isn't in any server where you are an administrator. Invite it to a server where you have the Manage Guild permission, then refresh this page.</div>`;
  icons();
}

/* --------------------------------------------------------------------------
   Guild picker
   -------------------------------------------------------------------------- */
function guildPicker() {
  return `<div class="guild-picker">
    <label class="field-label" for="guild-select">Server</label>
    <div class="select-wrap">
      <i data-lucide="server" class="select-icon"></i>
      <select id="guild-select" onchange="selectGuild(this.value)">
        ${guilds.map(g => `<option value="${g.id}" ${g.id===currentGuild?"selected":""}>${h(g.name)}</option>`).join("")}
      </select>
      <i data-lucide="chevron-down" class="chevron"></i>
    </div>
  </div>`;
}

function selectGuild(id) {
  currentGuild = id; localStorage.setItem("selectedGuild", id);
  const page = document.body.dataset.page || (location.pathname === "/" ? "dashboard" : location.pathname.slice(1));
  renderPage(page);
}

async function renderPage(page) {
  if (page === "dashboard") return renderDashboard();
  if (page === "tickets") return renderTickets();
  if (page === "warnings") return renderWarnings();
  if (page === "blacklist") return renderBlacklist();
  if (page === "members") return renderMembers();
  if (page === "giveaways") return renderGiveaways();
  if (page === "settings") return renderSettings();
  renderDashboard();
}

function setMain(htmlStr) {
  document.getElementById("main").innerHTML = htmlStr;
  icons();
}

function loadingState(label) {
  return `<div class="loading"><div class="spinner"></div><span>${h(label)}</span></div>`;
}

/* --------------------------------------------------------------------------
   Dashboard
   -------------------------------------------------------------------------- */
async function renderDashboard() {
  setMain(guildPicker() + loadingState("Loading stats…"));
  try {
    const s = await api(`/api/guild/${currentGuild}/stats`);
    setMain(guildPicker() + `
      <div class="page-title"><span class="icon-badge"><i data-lucide="layout-dashboard"></i></span>Dashboard</div>
      <div class="page-sub">Overview of ${h(guilds.find(g=>g.id===currentGuild)?.name||"")}</div>
      <div class="grid">
        ${statCard("users", "Total Members", s.totalMembers)}
        ${statCard("circle-dot", "Online Now", s.onlineMembers)}
        ${statCard("ticket", "Open Tickets", s.activeTickets)}
        ${statCard("inbox", "Total Tickets", s.totalTickets)}
        ${statCard("gift", "Active Giveaways", s.activeGiveaways)}
        ${statCard("triangle-alert", "Warnings", s.totalWarnings)}
      </div>`);
  } catch (e) {
    setMain(guildPicker() + errorState(e));
  }
}

function statCard(icon, label, value) {
  return `<div class="card glass">
    <div class="label"><i data-lucide="${icon}"></i>${h(label)}</div>
    <div class="value">${Number(value ?? 0).toLocaleString()}</div>
  </div>`;
}

function errorState(e) {
  return `<div class="err"><i data-lucide="circle-alert"></i><span>${h(e.error||e.message||e)}</span></div>`;
}

/* --------------------------------------------------------------------------
   Tickets
   -------------------------------------------------------------------------- */
async function renderTickets() {
  setMain(guildPicker() + loadingState("Loading tickets…"));
  try {
    const { tickets } = await api(`/api/guild/${currentGuild}/tickets`);
    if (!tickets.length) { setMain(guildPicker() + emptyState("Tickets", "No tickets yet.", "ticket")); return; }
    setMain(guildPicker() + `
      <div class="page-title"><span class="icon-badge"><i data-lucide="ticket"></i></span>Tickets</div>
      <div class="page-sub">Latest 25 tickets</div>
      <div class="table-wrap glass"><table><thead><tr><th>#</th><th>User</th><th>Category</th><th>Priority</th><th>Status</th><th>Claimed by</th><th>Created</th></tr></thead>
      <tbody>${tickets.map(t => `<tr>
        <td>${h(t.id)}</td>
        <td class="cell-user"><img class="avatar" src="${avatarURL(t.user_id, t.user_avatar)}" alt="" />${h(t.username)}</td>
        <td>${h(t.category||"-")}</td>
        <td>${h(t.priority||"-")}</td>
        <td>${statusBadge(t.status)}</td>
        <td>${t.claimed_by_name ? h(t.claimed_by_name) : '<span class="muted-dash">—</span>'}</td>
        <td>${new Date(t.created_at).toLocaleString()}</td>
      </tr>`).join("")}</tbody></table></div>`);
  } catch (e) {
    setMain(guildPicker() + errorState(e));
  }
}

function statusBadge(status) {
  if (status === "open") return `<span class="badge badge-open"><i data-lucide="circle-check"></i>${h(status)}</span>`;
  if (status === "claimed") return `<span class="badge badge-claimed"><i data-lucide="user-check"></i>${h(status)}</span>`;
  return `<span class="badge badge-closed"><i data-lucide="circle-x"></i>${h(status)}</span>`;
}

/* --------------------------------------------------------------------------
   Warnings
   -------------------------------------------------------------------------- */
async function renderWarnings() {
  setMain(guildPicker() + loadingState("Loading warnings…"));
  try {
    const { warnings } = await api(`/api/guild/${currentGuild}/warnings`);
    if (!warnings.length) { setMain(guildPicker() + emptyState("Warnings", "No warnings recorded.", "triangle-alert")); return; }
    setMain(guildPicker() + `
      <div class="page-title"><span class="icon-badge"><i data-lucide="triangle-alert"></i></span>Warnings</div>
      <div class="page-sub">Latest 50 warnings</div>
      <div class="table-wrap glass"><table><thead><tr><th>#</th><th>User</th><th>Reason</th><th>Moderator</th><th>Date</th></tr></thead>
      <tbody>${warnings.map(w => `<tr>
        <td>${h(w.id)}</td>
        <td class="cell-user"><img class="avatar" src="${avatarURL(w.user_id, w.user_avatar)}" alt="" />${h(w.username)}</td>
        <td>${h(w.reason)}</td>
        <td>${h(w.moderator_name||w.moderator_id)}</td>
        <td>${new Date(w.created_at).toLocaleString()}</td>
      </tr>`).join("")}</tbody></table></div>`);
  } catch (e) {
    setMain(guildPicker() + errorState(e));
  }
}

/* --------------------------------------------------------------------------
   Blacklist
   -------------------------------------------------------------------------- */
async function renderBlacklist() {
  setMain(guildPicker() + loadingState("Loading blacklist…"));
  try {
    const { blacklist } = await api(`/api/guild/${currentGuild}/blacklist`);
    if (!blacklist.length) { setMain(guildPicker() + emptyState("Blacklist", "No blacklisted users.", "shield-ban")); return; }
    setMain(guildPicker() + `
      <div class="page-title"><span class="icon-badge"><i data-lucide="shield-ban"></i></span>Blacklist</div>
      <div class="page-sub">Users blocked from using the bot</div>
      <div class="table-wrap glass"><table><thead><tr><th>User</th><th>Reason</th><th>Added by</th><th>Date</th><th></th></tr></thead>
      <tbody>${blacklist.map(b => `<tr>
        <td class="cell-user"><img class="avatar" src="${avatarURL(b.user_id, b.user_avatar)}" alt="" />${h(b.username)}</td>
        <td>${h(b.reason||"-")}</td>
        <td>${h(b.added_by_name||b.added_by)}</td>
        <td>${new Date(b.created_at).toLocaleString()}</td>
        <td><button class="btn btn-danger btn-sm" onclick="removeFromBlacklist('${b.user_id}', '${h(b.username)}')"><i data-lucide="trash-2"></i>Remove</button></td>
      </tr>`).join("")}</tbody></table></div>`);
  } catch (e) {
    setMain(guildPicker() + errorState(e));
  }
}

async function removeFromBlacklist(userId, name) {
  const ok = await confirmModal({
    title: "Remove from blacklist?",
    body: `${name} will be able to use the bot again in this server.`,
    confirmLabel: "Remove",
  });
  if (!ok) return;
  try {
    await fetch(`/api/guild/${currentGuild}/blacklist/${userId}`, { method: "DELETE", credentials: "same-origin" });
    toast(`${name} removed from blacklist`, "success");
    renderBlacklist();
  } catch (e) { toast("Failed: " + (e.error||e.message||e), "error"); }
}

/* --------------------------------------------------------------------------
   Members
   -------------------------------------------------------------------------- */
async function renderMembers() {
  setMain(guildPicker() + loadingState("Loading members…"));
  try {
    const { members, totalMembers } = await api(`/api/guild/${currentGuild}/members`);
    if (!members.length) { setMain(guildPicker() + emptyState("Members", "No members found.", "users")); return; }
    setMain(guildPicker() + `
      <div class="page-title"><span class="icon-badge"><i data-lucide="users"></i></span>Members</div>
      <div class="page-sub">Showing up to 100 members · ${totalMembers.toLocaleString()} total</div>
      <div class="table-wrap glass"><table><thead><tr><th>Member</th><th>Nickname</th><th>Joined</th><th>Roles</th></tr></thead>
      <tbody>${members.map(m => `<tr>
        <td class="cell-user"><img class="avatar" src="${avatarURL(m.id, m.avatar)}" alt="" />${h(m.username)}</td>
        <td>${h(m.nick||"")}</td>
        <td>${m.joined_at ? new Date(m.joined_at).toLocaleDateString() : "-"}</td>
        <td>${(m.roles||[]).length}</td>
      </tr>`).join("")}</tbody></table></div>`);
  } catch (e) {
    setMain(guildPicker() + errorState(e));
  }
}

/* --------------------------------------------------------------------------
   Giveaways
   -------------------------------------------------------------------------- */
async function renderGiveaways() {
  setMain(guildPicker() + loadingState("Loading giveaways…"));
  try {
    const { data } = await api(`/api/guild/${currentGuild}/table/giveaways`);
    if (!data || !data.length) { setMain(guildPicker() + emptyState("Giveaways", "No giveaways yet.", "gift")); return; }
    setMain(guildPicker() + `
      <div class="page-title"><span class="icon-badge"><i data-lucide="gift"></i></span>Giveaways</div>
      <div class="page-sub">All giveaways in this server</div>
      <div class="table-wrap glass"><table><thead><tr><th>Prize</th><th>Winners</th><th>Ends</th><th>Status</th></tr></thead>
      <tbody>${data.map(g => `<tr>
        <td>${h(g.prize||"-")}</td>
        <td>${h(g.winners||"-")}</td>
        <td>${g.end_time ? new Date(g.end_time).toLocaleString() : "-"}</td>
        <td>${g.ended ? `<span class="badge badge-closed"><i data-lucide="circle-x"></i>Ended</span>` : `<span class="badge badge-open"><i data-lucide="circle-check"></i>Active</span>`}</td>
      </tr>`).join("")}</tbody></table></div>`);
  } catch (e) {
    setMain(guildPicker() + errorState(e));
  }
}

/* --------------------------------------------------------------------------
   Settings (placeholder — no backend endpoint currently exposed)
   -------------------------------------------------------------------------- */
async function renderSettings() {
  setMain(guildPicker() + `
    <div class="page-title"><span class="icon-badge"><i data-lucide="settings"></i></span>Settings</div>
    <div class="page-sub">Configuration for ${h(guilds.find(g=>g.id===currentGuild)?.name||"this server")}</div>
    <div class="state-panel glass">
      <div class="state-icon"><i data-lucide="wrench"></i></div>
      <div class="state-title">Settings are on the way</div>
      <div>Server configuration options will appear here in a future update.</div>
    </div>`);
}

/* --------------------------------------------------------------------------
   Empty state
   -------------------------------------------------------------------------- */
function emptyState(title, sub, icon) {
  return `<div class="page-title"><span class="icon-badge"><i data-lucide="${icon}"></i></span>${h(title)}</div>
    <div class="page-sub">${h(sub)}</div>
    <div class="state-panel glass">
      <div class="state-icon"><i data-lucide="inbox"></i></div>
      <div class="state-title">Nothing to show</div>
      <div>${h(sub)}</div>
    </div>`;
}

boot();