
import { supabase } from "../../database/supabase.js";

export interface UserEconomy {
  user_id: string;
  guild_id: string;
  balance: number;
  bank: number;
  total_earned: number;
  daily_streak: number;
  last_daily: string;
}

export interface ShopItem {
  id: string;
  guild_id: string;
  name: string;
  description: string;
  price: number;
  role_id?: string;
  item_type: "role" | "item";
}

export interface UserInventory {
  user_id: string;
  guild_id: string;
  item_id: string;
  quantity: number;
}

export async function getUserEconomy(userId: string, guildId: string): Promise<UserEconomy> {
  const { data, error } = await supabase
    .from("user_economy")
    .select("*")
    .eq("user_id", userId)
    .eq("guild_id", guildId)
    .single();

  if (error || !data) {
    return {
      user_id: userId,
      guild_id: guildId,
      balance: 0,
      bank: 0,
      total_earned: 0,
      daily_streak: 0,
      last_daily: "",
    };
  }

  return data;
}

/**
 * Atomically increment a user's balance (and total_earned).
 *
 * Fixes C-05: previously this did a read→compute→upsert race that allowed
 * double-crediting under concurrent calls. It now delegates to the
 * `increment_balance` Postgres RPC (single statement, atomic).
 *
 * Returns the full refreshed UserEconomy row.
 */
export async function addBalance(userId: string, guildId: string, amount: number): Promise<UserEconomy> {
  const { error } = await supabase.rpc("increment_balance", {
    p_user_id: userId,
    p_guild_id: guildId,
    p_amount: amount,
  });

  if (error) throw error;

  return await getUserEconomy(userId, guildId);
}

/**
 * Atomically debit a user's balance, refusing the operation if the user has
 * insufficient funds.
 *
 * Fixes C-05: previously this did a read→check→upsert race that allowed
 * double-spending under concurrency. It now delegates to the `debit_balance`
 * Postgres RPC, which only updates the row when `balance >= amount` and
 * returns NULL otherwise — we translate NULL into "Insufficient balance".
 *
 * Returns the full refreshed UserEconomy row.
 */
export async function removeBalance(userId: string, guildId: string, amount: number): Promise<UserEconomy> {
  const { data, error } = await supabase.rpc("debit_balance", {
    p_user_id: userId,
    p_guild_id: guildId,
    p_amount: amount,
  });

  if (error) throw error;
  if (data === null || data === undefined) {
    throw new Error("Insufficient balance");
  }

  return await getUserEconomy(userId, guildId);
}

/**
 * Atomically transfer balance from one user to another in a single DB
 * transaction.
 *
 * Fixes C-05: previously this called removeBalance then addBalance as two
 * separate RPCs — a crash between them would lose money. The `transfer_balance`
 * RPC debits then credits inside one transaction and returns FALSE if the
 * sender had insufficient funds.
 */
export async function transferBalance(
  fromUserId: string,
  toUserId: string,
  guildId: string,
  amount: number
): Promise<void> {
  const { data, error } = await supabase.rpc("transfer_balance", {
    p_from_id: fromUserId,
    p_to_id: toUserId,
    p_guild_id: guildId,
    p_amount: amount,
  });

  if (error) throw error;
  if (data !== true) {
    throw new Error("Insufficient balance");
  }
}

/**
 * Claim the daily reward. Computes amount & streak in TS, then performs a
 * single atomic `claim_daily` RPC that updates balance, total_earned,
 * daily_streak and last_daily in one statement.
 *
 * Fixes M-09: previously the function performed a redundant second upsert
 * using the stale pre-`addBalance` balance (overwriting the just-credited
 * amount). The single RPC removes that race entirely.
 * Fixes C-05: the underlying credit is now atomic.
 */
export async function claimDaily(
  userId: string,
  guildId: string
): Promise<{ amount: number; streak: number; isNewDay: boolean }> {
  const current = await getUserEconomy(userId, guildId);
  const now = new Date();
  const today = now.toDateString();
  const lastDaily = current.last_daily ? new Date(current.last_daily).toDateString() : "";

  if (lastDaily === today) {
    return { amount: 0, streak: current.daily_streak, isNewDay: false };
  }

  // Streak rollover logic (kept in TS; only the write is atomic).
  let streak = current.daily_streak;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (lastDaily === yesterday.toDateString()) {
    streak += 1;
  } else {
    streak = 1;
  }

  const baseAmount = 100;
  const streakBonus = Math.min(streak * 10, 100);
  const amount = baseAmount + streakBonus;

  const { error } = await supabase.rpc("claim_daily", {
    p_user_id: userId,
    p_guild_id: guildId,
    p_amount: amount,
    p_streak: streak,
  });

  if (error) throw error;

  return { amount, streak, isNewDay: true };
}

export async function getShopItems(guildId: string): Promise<ShopItem[]> {
  const { data, error } = await supabase
    .from("shop_items")
    .select("*")
    .eq("guild_id", guildId);

  if (error) throw error;
  return (data as ShopItem[]) || [];
}

export async function addShopItem(
  guildId: string,
  name: string,
  description: string,
  price: number,
  roleId?: string,
  itemType: "role" | "item" = "item"
): Promise<void> {
  const { error } = await supabase
    .from("shop_items")
    .insert({
      guild_id: guildId,
      name,
      description,
      price,
      role_id: roleId,
      item_type: itemType,
    });

  if (error) throw error;
}

export async function removeShopItem(itemId: string): Promise<void> {
  const { error } = await supabase
    .from("shop_items")
    .delete()
    .eq("id", itemId);

  if (error) throw error;
}

/**
 * Purchase a shop item: debits the price atomically, then — for non-role
 * items — atomically increments the inventory quantity via the
 * `increment_inventory` RPC.
 *
 * Fixes H-08: previously this used `upsert({ quantity: 1 })` which reset the
 * quantity to 1 when buying a second of the same item, and the upsert lacked
 * an explicit `onConflict` target. The RPC uses
 * `ON CONFLICT (user_id, guild_id, item_id) DO UPDATE SET quantity = quantity + 1`.
 */
export async function purchaseItem(
  userId: string,
  guildId: string,
  itemId: string
): Promise<ShopItem> {
  const { data: item, error: itemError } = await supabase
    .from("shop_items")
    .select("*")
    .eq("id", itemId)
    .single();

  if (itemError || !item) throw new Error("Item not found");

  // Atomic debit — throws "Insufficient balance" if the user can't afford it.
  await removeBalance(userId, guildId, item.price);

  if (item.item_type === "role" && item.role_id) {
    // Role assignment is handled by the calling command (needs guild context).
  } else {
    const { error: invError } = await supabase.rpc("increment_inventory", {
      p_user_id: userId,
      p_guild_id: guildId,
      p_item_id: itemId,
    });
    if (invError) throw invError;
  }

  return item as ShopItem;
}

export async function getUserInventory(userId: string, guildId: string): Promise<UserInventory[]> {
  const { data, error } = await supabase
    .from("user_inventory")
    .select("*")
    .eq("user_id", userId)
    .eq("guild_id", guildId);

  if (error) throw error;
  return (data as UserInventory[]) || [];
}

export async function getEconomyLeaderboard(guildId: string, limit: number = 10): Promise<UserEconomy[]> {
  const { data, error } = await supabase
    .from("user_economy")
    .select("*")
    .eq("guild_id", guildId)
    .order("balance", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as UserEconomy[]) || [];
}
