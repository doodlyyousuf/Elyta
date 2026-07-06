import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export interface UserLevel {
  user_id: string;
  guild_id: string;
  xp: number;
  level: number;
  total_xp: number;
}

export interface LevelReward {
  guild_id: string;
  level: number;
  role_id: string;
}

export async function getUserLevel(userId: string, guildId: string): Promise<UserLevel> {
  const { data, error } = await supabase
    .from("user_levels")
    .select("*")
    .eq("user_id", userId)
    .eq("guild_id", guildId)
    .single();

  if (error || !data) {
    return {
      user_id: userId,
      guild_id: guildId,
      xp: 0,
      level: 1,
      total_xp: 0,
    };
  }

  return data;
}

export async function addXP(userId: string, guildId: string, amount: number): Promise<UserLevel> {
  const current = await getUserLevel(userId, guildId);
  const newXP = current.xp + amount;
  const newTotalXP = current.total_xp + amount;
  const newLevel = calculateLevel(newTotalXP);

  const { data, error } = await supabase
    .from("user_levels")
    .upsert({
      user_id: userId,
      guild_id: guildId,
      xp: newXP,
      level: newLevel,
      total_xp: newTotalXP,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function calculateLevel(totalXP: number): number {
  return Math.floor(Math.sqrt(totalXP / 100)) + 1;
}

export function xpForLevel(level: number): number {
  return Math.pow(level - 1, 2) * 100;
}

export function xpToNextLevel(currentLevel: number): number {
  return xpForLevel(currentLevel + 1) - xpForLevel(currentLevel);
}

export async function getLevelRewards(guildId: string): Promise<LevelReward[]> {
  const { data, error } = await supabase
    .from("level_rewards")
    .select("*")
    .eq("guild_id", guildId)
    .order("level", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function addLevelReward(guildId: string, level: number, roleId: string): Promise<void> {
  const { error } = await supabase
    .from("level_rewards")
    .upsert({
      guild_id: guildId,
      level,
      role_id: roleId,
    });

  if (error) throw error;
}

export async function removeLevelReward(guildId: string, level: number): Promise<void> {
  const { error } = await supabase
    .from("level_rewards")
    .delete()
    .eq("guild_id", guildId)
    .eq("level", level);

  if (error) throw error;
}

export async function getLeaderboard(guildId: string, limit: number = 10): Promise<UserLevel[]> {
  const { data, error } = await supabase
    .from("user_levels")
    .select("*")
    .eq("guild_id", guildId)
    .order("total_xp", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}
