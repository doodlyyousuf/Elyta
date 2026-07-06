import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

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

export async function addBalance(userId: string, guildId: string, amount: number): Promise<UserEconomy> {
  const current = await getUserEconomy(userId, guildId);
  const newBalance = current.balance + amount;
  const newTotalEarned = current.total_earned + amount;

  const { data, error } = await supabase
    .from("user_economy")
    .upsert({
      user_id: userId,
      guild_id: guildId,
      balance: newBalance,
      bank: current.bank,
      total_earned: newTotalEarned,
      daily_streak: current.daily_streak,
      last_daily: current.last_daily,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeBalance(userId: string, guildId: string, amount: number): Promise<UserEconomy> {
  const current = await getUserEconomy(userId, guildId);
  if (current.balance < amount) {
    throw new Error("Insufficient balance");
  }

  const newBalance = current.balance - amount;

  const { data, error } = await supabase
    .from("user_economy")
    .upsert({
      user_id: userId,
      guild_id: guildId,
      balance: newBalance,
      bank: current.bank,
      total_earned: current.total_earned,
      daily_streak: current.daily_streak,
      last_daily: current.last_daily,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function transferBalance(
  fromUserId: string,
  toUserId: string,
  guildId: string,
  amount: number
): Promise<void> {
  await removeBalance(fromUserId, guildId, amount);
  await addBalance(toUserId, guildId, amount);
}

export async function claimDaily(userId: string, guildId: string): Promise<{ amount: number; streak: number; isNewDay: boolean }> {
  const current = await getUserEconomy(userId, guildId);
  const now = new Date();
  const today = now.toDateString();
  const lastDaily = current.last_daily ? new Date(current.last_daily).toDateString() : "";

  let streak = current.daily_streak;
  let isNewDay = false;

  if (lastDaily !== today) {
    isNewDay = true;
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

    await addBalance(userId, guildId, amount);

    const { error } = await supabase
      .from("user_economy")
      .upsert({
        user_id: userId,
        guild_id: guildId,
        balance: current.balance + amount,
        bank: current.bank,
        total_earned: current.total_earned + amount,
        daily_streak: streak,
        last_daily: now.toISOString(),
      });

    if (error) throw error;

    return { amount, streak, isNewDay };
  }

  return { amount: 0, streak, isNewDay: false };
}

export async function getShopItems(guildId: string): Promise<ShopItem[]> {
  const { data, error } = await supabase
    .from("shop_items")
    .select("*")
    .eq("guild_id", guildId);

  if (error) throw error;
  return data || [];
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

export async function purchaseItem(
  userId: string,
  guildId: string,
  itemId: string
): Promise<ShopItem> {
  const item = await supabase
    .from("shop_items")
    .select("*")
    .eq("id", itemId)
    .single();

  if (!item.data) throw new Error("Item not found");

  await removeBalance(userId, guildId, item.data.price);

  if (item.data.item_type === "role" && item.data.role_id) {
    // Role assignment would be handled by the command
  } else {
    await supabase
      .from("user_inventory")
      .upsert({
        user_id: userId,
        guild_id: guildId,
        item_id: itemId,
        quantity: 1,
      });
  }

  return item.data;
}

export async function getUserInventory(userId: string, guildId: string): Promise<UserInventory[]> {
  const { data, error } = await supabase
    .from("user_inventory")
    .select("*")
    .eq("user_id", userId)
    .eq("guild_id", guildId);

  if (error) throw error;
  return data || [];
}

export async function getEconomyLeaderboard(guildId: string, limit: number = 10): Promise<UserEconomy[]> {
  const { data, error } = await supabase
    .from("user_economy")
    .select("*")
    .eq("guild_id", guildId)
    .order("balance", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}
