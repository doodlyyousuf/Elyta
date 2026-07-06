# 👥 Staff Guide - Ticket System Operations

## Overview

This guide explains how to use the ticket system as a staff member.

---

## 🎯 Daily Workflow

### 1. Check Open Tickets
1. Go to Discord ticket-logs channel
2. Look for recent "Ticket Created" messages
3. Or check Supabase Dashboard: Data Browser → `tickets` table, filter `status = 'open'`

### 2. Claim a Ticket
1. Go to the ticket channel (e.g., `#🆘-ticket-username`)
2. Click **"Claim Ticket"** button at the top
3. ✅ You'll see: "🔒 Ticket Claimed - Staff <@your_id> has claimed this ticket"
4. User messages are now locked (read-only) to prevent accidental posts during review

### 3. Work on Ticket
- Read user's message
- Provide assistance
- **You can still send messages** even though user messages are locked
- Stay professional and helpful

### 4. Release Ticket (if needed)
1. If you need another staff member to take over
2. Click **"Release Ticket"** button (if implemented)
3. Or ask another staff to claim it (old claim will auto-release)

### 5. Close Ticket
1. Click **"Close Ticket"** button (red button)
2. Bot will:
   - ✅ Generate transcript (HTML file)
   - ✅ Archive all images to `#ticket-images` channel
   - ✅ Save everything to Supabase
   - ✅ Delete channel after 3 seconds

---

## 📋 Ticket Categories

Tickets come in 3 categories:

| Category | Emoji | Use Case |
|----------|-------|----------|
| **Support** | 🆘 | General help, questions, troubleshooting |
| **Report** | 📢 | Bug reports, abuse reports, complaints |
| **Order** | 📦 | Order status, shipping, purchases |

Each category is prefixed in channel name for easy scanning.

---

## 👁️ Understanding Ticket Status

### 🟢 Open
- Ticket is active and needs attention
- User or staff can work on it
- User messages locked once claimed

### 🟡 Claimed
- A staff member has taken ownership
- Only that staff can see "release" option
- User messages are locked (read-only)

### 🔴 Closed
- Ticket completed
- Channel will be deleted
- Transcript saved permanently
- Images archived (never break links)

---

## 📊 Using the Dashboard

### Quick Check
1. Go to [Supabase Console](https://supabase.com/dashboard)
2. Select `cus_dis_bot` project
3. Click **Data Browser**
4. Select `tickets` table
5. Filter: `status = 'open'`
6. Sort: `created_at DESC` (oldest first)

### View Your Claims
```
Filter: claimed_by = [YOUR_USER_ID]
```

### Find Unclaimed Tickets
```
Filter: claimed_by IS NULL AND status = 'open'
```

### View Transcripts
1. Go to `ticket_transcripts` table
2. Click URL in `transcript_url` column
3. Download as HTML file
4. Share with user if needed

### View Archived Images
1. Go to `ticket_images` table
2. Click `archived_url` to view or download
3. Original images are in Discord's `#ticket-images` channel

---

## ⚡ Quick Actions

### Claim Without Discord
If Discord is down, you can still manage via Supabase:
1. Go to Supabase Data Browser
2. Click `tickets` table
3. Edit `claimed_by` field manually
4. Set to your user ID

### Mark Resolved Manually
1. Go to Supabase
2. Edit `status` field
3. Change from `open` to `closed`
4. (Preferred: use Discord button for logs)

---

## 🎓 Best Practices

### ✅ DO:
- Claim tickets you're working on
- Release if you need help or handoff
- Keep responses professional and helpful
- Provide clear solutions/next steps
- Close when resolved (always use button)

### ❌ DON'T:
- Delete tickets manually (use close button)
- Leave tickets unclaimed for days
- Edit user messages (they're locked anyway)
- Delete the `#ticket-images` or `#ticket-archives` channels
- Close other staff's claimed tickets

---

## 📞 Common Issues

### "Ticket Already Claimed"
- ✅ Good! Another staff member is helping
- Reach out in staff chat to coordinate

### User Messages Locked
- ✅ This is normal when claimed
- User can still see the ticket
- User can react or await response

### Images Not Showing
- ✅ Check `#ticket-images` channel
- All images are archived there permanently
- Use Supabase dashboard to find exact URL

### Transcript Download Failed
- ✅ Check `#ticket-archives` channel
- Files are stored as Discord attachments
- Try downloading from there

---

## 📈 Performance Metrics

You can view your performance in Supabase:
```sql
SELECT 
  COUNT(DISTINCT ticket_id) as tickets_claimed,
  COUNT(DISTINCT CASE WHEN t.status = 'closed' THEN t.id END) as closed
FROM ticket_claims tc
LEFT JOIN tickets t ON tc.ticket_id = t.id
WHERE tc.staff_id = 'YOUR_USER_ID';
```

---

## 🆘 Need Help?

- **Bot not responding?** Check bot status in Discord
- **Dashboard questions?** See SUPABASE_DASHBOARD_GUIDE.md
- **Technical issues?** Contact admin

All staff actions are logged for audit trail.
