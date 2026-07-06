# 📊 Supabase Dashboard Staff Guide

## Access the Dashboard

1. Go to [Supabase Console](https://supabase.com/dashboard)
2. Log in with your account
3. Select project: `cus_dis_bot`
4. Navigate to **SQL Editor** or **Data Browser**

---

## 🎫 Viewing Tickets

### Option 1: Data Browser (Easy)
1. Click **Data Browser** (left sidebar)
2. Select `tickets` table
3. View all tickets in real-time:
   - User ID
   - Guild ID
   - Channel ID
   - Status (open/closed)
   - Category (support/report/order)
   - Claimed by (staff ID)

### Option 2: SQL Queries (Advanced)
Run custom queries in **SQL Editor**:

**Get all open tickets:**
```sql
SELECT 
  id, user_id, channel_id, category, claimed_by, created_at 
FROM tickets 
WHERE status = 'open' 
ORDER BY created_at DESC;
```

**Get tickets claimed by specific staff:**
```sql
SELECT 
  id, user_id, channel_id, category, created_at 
FROM tickets 
WHERE claimed_by = 'STAFF_USER_ID' AND status = 'open';
```

**Get tickets by category:**
```sql
SELECT 
  id, user_id, channel_id, claimed_by, created_at 
FROM tickets 
WHERE category = 'support' AND status = 'open';
```

**Get ticket statistics:**
```sql
SELECT 
  category, 
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'open' THEN 1 END) as open,
  COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed
FROM tickets
GROUP BY category;
```

---

## 👤 Staff Claims

### View Claims
1. Click **Data Browser** → `ticket_claims` table
2. See all staff claims with:
   - Ticket ID
   - Staff member (staff_id)
   - Claimed at (timestamp)
   - Released at (timestamp)
   - Notes

### Find Unclaimed Tickets
```sql
SELECT 
  id, user_id, channel_id, category, created_at 
FROM tickets 
WHERE claimed_by IS NULL AND status = 'open'
ORDER BY created_at ASC;
```

### Find Staff's Active Claims
```sql
SELECT 
  t.id, t.user_id, t.channel_id, tc.claimed_at
FROM tickets t
JOIN ticket_claims tc ON t.id = tc.ticket_id
WHERE tc.staff_id = 'STAFF_USER_ID' AND tc.released_at IS NULL
ORDER BY tc.claimed_at DESC;
```

---

## 📋 Transcripts

### View Saved Transcripts
1. Click **Data Browser** → `ticket_transcripts` table
2. See:
   - Ticket ID
   - Transcript file URL (clickable)
   - Created at

### Find Transcripts for User
```sql
SELECT 
  tt.id, t.user_id, tt.transcript_url, tt.created_at
FROM ticket_transcripts tt
JOIN tickets t ON tt.ticket_id = t.id
WHERE t.user_id = 'USER_ID'
ORDER BY tt.created_at DESC;
```

**Download transcript:**
- Click the URL in `transcript_url` column
- Browser downloads HTML file

---

## 🖼️ Image Archive

### View Archived Images
1. Click **Data Browser** → `ticket_images` table
2. See all archived images with:
   - Original URL (before deletion)
   - Archived URL (preserved in Discord)
   - File name
   - Created at

### Find Images from Specific Ticket
```sql
SELECT 
  original_url, archived_url, file_name, created_at
FROM ticket_images
WHERE ticket_id = TICKET_ID
ORDER BY created_at DESC;
```

---

## 📊 Analytics & Reports

### Ticket Volume by Category
```sql
SELECT 
  category, 
  COUNT(*) as count,
  ROUND(AVG(EXTRACT(EPOCH FROM (closed_at - created_at))/3600), 1) as avg_hours_to_close
FROM tickets
WHERE status = 'closed'
GROUP BY category
ORDER BY count DESC;
```

### Staff Performance
```sql
SELECT 
  tc.staff_id,
  COUNT(DISTINCT tc.ticket_id) as tickets_claimed,
  COUNT(DISTINCT CASE WHEN t.status = 'closed' THEN t.id END) as closed_tickets
FROM ticket_claims tc
LEFT JOIN tickets t ON tc.ticket_id = t.id
GROUP BY tc.staff_id
ORDER BY tickets_claimed DESC;
```

### Response Time Analysis
```sql
SELECT 
  id,
  user_id,
  category,
  DATE_TRUNC('day', created_at) as day,
  EXTRACT(EPOCH FROM (closed_at - created_at))/3600 as hours_to_close
FROM tickets
WHERE status = 'closed'
ORDER BY created_at DESC
LIMIT 50;
```

---

## 🔧 Manual Actions

### Mark Ticket as Closed (if needed)
```sql
UPDATE tickets
SET status = 'closed'
WHERE id = TICKET_ID;
```

### Add Note to Claim
```sql
UPDATE ticket_claims
SET notes = 'Need to follow up with user'
WHERE ticket_id = TICKET_ID;
```

### Remove Claim from Ticket
```sql
UPDATE tickets
SET claimed_by = NULL
WHERE id = TICKET_ID;
```

---

## 🔐 Best Practices

✅ **DO:**
- Check dashboard for unresponded tickets regularly
- Filter by oldest first to prioritize
- Use queries to find patterns
- Track staff performance metrics

❌ **DON'T:**
- Delete any data (use status 'closed' instead)
- Modify user_id or channel_id directly
- Create tickets manually (use Discord bot)

---

## 📞 Need Help?

- **Tickets stuck?** Check claimed_by and release if needed
- **Images broken?** Check ticket_images table for archive
- **Staff workload high?** Run performance analytics to see who needs help

All data is automatically synced with Discord bot in real-time.
