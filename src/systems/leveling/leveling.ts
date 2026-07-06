
import { GuildMember } from "discord.js";
import { supabase } from "../../database/supabase.js";

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

/** Result of addXP — includes level-up info so the caller can assign roles. */
export interface AddXPResult {
  user: UserLevel;
  leveledUp: boolean;
  newLevel: number;
  oldLevel: number;
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

  return data as UserLevel;
}

/**
 * Add XP to a user, persist the new totals, and report whether the user
 * leveled up.
 *
 * Fixes H-10: previously this function upserted the recomputed level but
 * never compared old vs new level and never consulted `level_rewards` — so
 * the entire "Level Roles" feature was dead. Because `addXP` does not have
 * a member/guild context, role assignment is delegated to the new exported
 * `assignLevelRoles` function, which the caller (messageCreate leveling path)
 * invokes when `leveledUp === true`.
 */
export async function addXP(userId: string, guildId: string, amount: number): Promise<AddXPResult> {
  const current = await getUserLevel(userId, guildId);
  const oldLevel = current.level || 1;

  const newXP = current.xp + amount;
  const newTotalXP = current.total_xp + amount;
  const newLevel = calculateLevel(newTotalXP);
  const leveledUp = newLevel > oldLevel;

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

  return {
    user: (data as UserLevel) ?? {
      user_id: userId,
      guild_id: guildId,
      xp: newXP,
      level: newLevel,
      total_xp: newTotalXP,
    },
    leveledUp,
    newLevel,
    oldLevel,
  };
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
  return (data as LevelReward[]) || [];
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
  return (data as UserLevel[]) || [];
}

/**
 * Assign all level-reward roles for the member's guild whose level is
 * `<= newLevel`. Roles the member already has are skipped. Returns the role
 * IDs that were actually added (in the order they were processed).
 *
 * The messageCreate leveling path should call this after `addXP` reports
 * `leveledUp === true`. Roles are added best-effort: a failure on one role
 * (permissions, missing role, etc.) is logged and does not abort the rest.
 */
export async function assignLevelRoles(member: GuildMember, newLevel: number): Promise<string[]> {
  const { data, error } = await supabase
    .from("level_rewards")
    .select("level, role_id")
    .eq("guild_id", member.guild.id)
    .lte("level", newLevel);

  if (error) throw error;
  if (!data || data.length === 0) return [];

  const added: string[] = [];
  for (const row of data) {
    const roleId: string | undefined = row.role_id;
    if (!roleId) continue;
    if (member.roles.cache.has(roleId)) continue;

    try {
      await member.roles.add(roleId, `Level reward: reached level ${row.level}`);
      added.push(roleId);
    } catch (err) {
      console.error(
        `[leveling] Failed to add level-reward role ${roleId} to ${member.id}:`,
        err
      );
    }
  }

  return added;
}
