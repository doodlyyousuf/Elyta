
import { supabase } from "../../database/supabase.js";
import { recordEarnings } from "./earningsTracker.js";

export async function createOrder(guildId: string, userId: string, description: string, price: number = 0) {
  const { data, error } = await supabase
    .from("smp_orders")
    .insert({ guild_id: guildId, user_id: userId, description, status: "pending", price })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getOrder(orderId: number) {
  const { data } = await supabase.from("smp_orders").select("*").eq("id", orderId).single();
  return data;
}

export async function getUserOrders(guildId: string, userId: string) {
  const { data } = await supabase
    .from("smp_orders")
    .select("*")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data || [];
}

export async function updateOrderStatus(orderId: number, status: string, builderId?: string, price?: number) {
  // Use explicit `!== undefined` checks so that a legitimate `price` of 0
  // (free order) and an explicit empty-string `builderId` are still written.
  // Fixes M-13: the previous `if (builderId)` / `if (price)` guards dropped
  // falsy-but-valid values.
  const updateData: { status: string; builder_id?: string; price?: number } = { status };
  if (builderId !== undefined) updateData.builder_id = builderId;
  if (price !== undefined) updateData.price = price;

  const { data, error } = await supabase
    .from("smp_orders")
    .update(updateData)
    .eq("id", orderId)
    .select()
    .single();
  if (error) throw error;

  // Record earnings when an order is completed — including free (price 0)
  // orders and orders where builderId is an explicit empty string. The
  // previous `if (status === "completed" && builderId && price)` guard
  // skipped free completed orders entirely.
  if (status === "completed" && builderId !== undefined && price !== undefined) {
    await recordEarnings(data.guild_id, builderId, orderId, price);
  }

  return data;
}
