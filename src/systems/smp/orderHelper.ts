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
  const updateData: any = { status };
  if (builderId) updateData.builder_id = builderId;
  if (price) updateData.price = price;

  const { data, error } = await supabase
    .from("smp_orders")
    .update(updateData)
    .eq("id", orderId)
    .select()
    .single();
  if (error) throw error;

  // Record earnings when order is completed
  if (status === "completed" && builderId && price) {
    await recordEarnings(data.guild_id, builderId, orderId, price);
  }

  return data;
}
