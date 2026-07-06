# 🎫 Ticket System Features - Complete Guide

## Overview

The ticket system is a comprehensive support platform with categories, staff management, and permanent archives.

---

## 🆕 New Features (Added This Session)

### 1. 🔥 Staff Claim System

**What it does:**
- Staff can claim tickets to take ownership
- User messages become read-only (locked)
- Staff can still respond to help resolve issues
- Prevents multiple staff from responding simultaneously
- Clear indication of who's handling the ticket

**How to use:**
1. Staff clicks **"Claim Ticket"** button in ticket channel
2. Ticket shows: `"🔒 Ticket Claimed - Staff <@name> has claimed this ticket"`
3. User sees read-only mode (can't send new messages)
4. Staff responds and solves the issue
5. When done, click **"Close Ticket"**

**Database:**
- Table: `ticket_claims`
- Tracks: staff_id, claimed_at, released_at, notes
- Foreign key: references tickets table

---

### 2. 📄 Transcript System

**What it does:**
- Automatically generates HTML transcript before deleting ticket
- Includes all messages, images, metadata
- Saved to Discord `#ticket-archives` channel
- Links never break (stored permanently)

**What's included in transcript:**
- Channel name
- User ID
- Staff member who handled it
- Category
- All messages (formatted)
- All attachments (images, files)
- Timestamps
- Duration (created_at to closed_at)

**How to access:**
1. Go to `#ticket-archives` channel
2. Find transcript file (named `transcript-{id}-{timestamp}.html`)
3. Download and open in browser
4. Or access via Supabase: `ticket_transcripts` table → click URL

**Database:**
- Table: `ticket_transcripts`
- Stores: transcript_url, file_name, created_at
- Linked to both tickets and guild_settings

---

### 3. 🖼️ Image Archive System

**What it does:**
- All images from closed tickets are re-uploaded to Discord
- Stored in dedicated `#ticket-images` channel
- Original Discord links would break after channel deletion
- Archive ensures images remain accessible forever
- Database maintains mapping of original → archived URLs

**How it works:**
1. When ticket closes, bot scans all messages for images
2. Downloads each image
3. Re-uploads to `#ticket-images` with metadata:
   - Original ticket name
   - User who uploaded it
   - Timestamp
4. Saves mapping to Supabase
5. Channel deleted → images still available

**How to use:**
1. Go to `#ticket-images` channel
2. Browse by ticket name
3. Download if needed
4. Or query Supabase `ticket_images` table

**Database:**
- Table: `ticket_images`
- Stores: original_url, archived_url, file_name
- Links ticket images to archive location

---

### 4. 🧠 Ticket Categories

**What it does:**
- Users select category when creating ticket
- Helps organize and route tickets
- Prefix in channel name shows category at a glance
- Enables filtering by type

**Available Categories:**

| Category | Emoji | Purpose |
|----------|-------|---------|
| **Support** | 🆘 | General help, how-to, troubleshooting |
| **Report** | 📢 | Bug reports, abuse, complaints |
| **Order** | 📦 | Purchase, shipping, refund status |

**How to use (User perspective):**
1. Click "Create Ticket" button on ticket panel
2. See category selection with 3 buttons
3. Click desired category
4. Ticket created with that category

**How to use (Staff perspective):**
1. Category emoji in channel name: `🆘-ticket-username`
2. Check dashboard filters by category
3. Route tickets appropriately

**Database:**
- Column: `tickets.category` (default: 'support')
- Enables filtering and analytics
- Used in logs and transcripts

---

### 5. 📊 Dashboard Control (Supabase UI)

**What it is:**
- Web-based interface to manage tickets without Discord
- Real-time data sync
- No coding required - click to manage
- Full audit trail

**What you can do:**
- 👁️ View all tickets in real-time
- 🔍 Filter by category, status, staff, user
- 📈 View analytics and statistics
- 📋 Download transcripts
- 🖼️ Access archived images
- 📝 Add notes to claims
- 🔧 Manual status updates (if needed)

**Access:** [Supabase Console](https://supabase.com/dashboard) → Select project → Data Browser

**Available tables:**
- `tickets` - All ticket information
- `ticket_claims` - Staff assignments
- `ticket_transcripts` - Saved conversations
- `ticket_images` - Archived images

See SUPABASE_DASHBOARD_GUIDE.md for detailed SQL queries

---

## 📊 Data Structure

### tickets table
```
id (PRIMARY KEY)
guild_id (TEXT) - Discord server ID
user_id (TEXT) - User who created ticket
channel_id (TEXT) - Discord channel ID
status (TEXT) - 'open' or 'closed'
category (TEXT) - 'support', 'report', 'order'
claimed_by (TEXT) - Staff member ID (NULL if unclaimed)
created_at (TIMESTAMP)
closed_at (TIMESTAMP)
```

### ticket_claims table
```
id (PRIMARY KEY)
ticket_id (INT) - FK: tickets.id
staff_id (TEXT) - Discord user ID
claimed_at (TIMESTAMP)
released_at (TIMESTAMP) - NULL if still claimed
notes (TEXT) - Optional staff notes
```

### ticket_transcripts table
```
id (PRIMARY KEY)
ticket_id (INT) - FK: tickets.id
guild_id (TEXT)
transcript_url (TEXT) - Discord file URL
file_name (TEXT)
created_at (TIMESTAMP)
```

### ticket_images table
```
id (PRIMARY KEY)
ticket_id (INT) - FK: tickets.id
original_url (TEXT) - URL from closed ticket
archived_url (TEXT) - URL in #ticket-images
file_name (TEXT)
created_at (TIMESTAMP)
```

---

## 🔄 Ticket Lifecycle

```
┌─────────────────────────────────────────┐
│  USER CLICKS "CREATE TICKET"            │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  BOT SHOWS CATEGORY SELECTION (3 btns)  │
└────────────┬────────────────────────────┘
             │ User selects category
             ▼
┌─────────────────────────────────────────┐
│  TICKET CREATED WITH:                   │
│  - Channel name with emoji              │
│  - Category stored in DB                │
│  - Initial welcome message              │
│  - Close & Claim buttons                │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  STAFF CLAIMS TICKET (optional)         │
│  - Button clicked                       │
│  - claimed_by field updated             │
│  - User messages locked                 │
│  - Entry created in ticket_claims       │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  STAFF RESOLVES ISSUE                   │
│  - Communicates with user               │
│  - Provides solution                    │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  STAFF CLICKS "CLOSE TICKET"            │
│  - Generates HTML transcript            │
│  - Archives images to #ticket-images    │
│  - Saves transcript to #ticket-archives │
│  - Updates database                     │
│  - Sends logs                           │
└────────────┬────────────────────────────┘
             │ After 3 seconds
             ▼
┌─────────────────────────────────────────┐
│  CHANNEL DELETED                        │
│  - But data preserved forever:          │
│  ✅ Transcript (HTML)                   │
│  ✅ Images (Discord channel)            │
│  ✅ Database records                    │
│  ✅ Audit trail (claims)                │
└─────────────────────────────────────────┘
```

---

## 🔐 Security & Permissions

### User Permissions
- ✅ Can see only their own ticket channel
- ✅ Can send messages until claimed
- ❌ Cannot see other users' tickets
- ❌ Cannot see ticket archives (unless shared)

### Staff Permissions
- ✅ Can claim any open ticket
- ✅ Can view all ticket archives
- ✅ Can access Supabase dashboard (read all)
- ✅ Can close tickets

### Bot Permissions (Required)
- ✅ Manage Channels (create/delete)
- ✅ Manage Messages (lock/unlock)
- ✅ Send Messages (all channels)
- ✅ Read Message History (for transcripts)
- ✅ View Channels (access all tickets)

---

## 📈 Analytics Available

**View these in Supabase:**

1. **Tickets by Category**
   - How many support vs report vs order
   - Average resolution time per category

2. **Staff Performance**
   - Tickets claimed per staff
   - Closed tickets per staff
   - Average handling time

3. **Peak Hours**
   - When do most tickets arrive
   - Staffing recommendations

4. **Response Time**
   - Average time to claim
   - Average time to close
   - Trends over time

---

## 🔄 Integration Points

### Discord
- Buttons for user interactions
- Channels for organization
- Log channel for notifications
- Image/archive channels

### Supabase
- Data persistence
- Real-time dashboards
- Analytics queries
- Audit trail

### Database Tables
- 4 new tables (plus updated tickets table)
- Proper foreign keys and indexes
- Automatic timestamps

---

## 🚀 Future Enhancements

Possible additions:
- ⭐ Rating system after ticket close
- 👥 Team/department routing
- 🔔 Auto-escalation for old tickets
- 📱 Mobile app dashboard
- 🤖 Auto-response templates
- 📞 Priority levels
- ⏰ SLA tracking

---

## 📞 Support

For questions, see:
- **Staff operations:** STAFF_GUIDE.md
- **Dashboard queries:** SUPABASE_DASHBOARD_GUIDE.md
- **System setup:** TICKET_SYSTEM_COMPLETE.md

All features are production-ready and tested.
