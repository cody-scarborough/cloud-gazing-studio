import { supabase } from "@/integrations/supabase/client";
import { isCloudSeed, type CloudSeed } from "@/lib/sky/cloud";

export type Sighting = {
  id: string;
  text: string;
  seed: CloudSeed;
  skyTime: number;
  isPublic: boolean;
  createdAt: string;
  userId: string;
  author?: string | undefined;
};

type Row = {
  id: string;
  user_id: string;
  text: string;
  cloud_seed: unknown;
  sky_time: number;
  is_public: boolean;
  created_at: string;
};

function toSighting(row: Row, author?: string): Sighting | null {
  if (!isCloudSeed(row.cloud_seed)) return null;
  return {
    id: row.id,
    userId: row.user_id,
    text: row.text,
    seed: row.cloud_seed,
    skyTime: row.sky_time,
    isPublic: row.is_public,
    createdAt: row.created_at,
    author,
  };
}

export async function createSighting(input: {
  text: string;
  seed: CloudSeed;
  skyTime: number;
  isPublic: boolean;
}) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("You need to be signed in to keep a sighting.");

  const { error } = await supabase.from("sightings").insert({
    user_id: userId,
    text: input.text,
    cloud_seed: input.seed as unknown as never,
    sky_time: input.skyTime,
    is_public: input.isPublic,
  });
  if (error) throw error;
}

export async function listMySightings(): Promise<Sighting[]> {
  const { data, error } = await supabase
    .from("sightings")
    .select("id, user_id, text, cloud_seed, sky_time, is_public, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return ((data ?? []) as Row[]).map((r) => toSighting(r)).filter((s): s is Sighting => !!s);
}

export async function listPublicSightings(): Promise<Sighting[]> {
  const { data, error } = await supabase
    .from("sightings")
    .select("id, user_id, text, cloud_seed, sky_time, is_public, created_at")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw error;

  const rows = (data ?? []) as Row[];
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", ids);
    for (const p of (profiles ?? []) as { id: string; display_name: string }[]) {
      names.set(p.id, p.display_name);
    }
  }
  return rows
    .map((r) => toSighting(r, names.get(r.user_id) ?? "Cloudspotter"))
    .filter((s): s is Sighting => !!s);
}

export async function deleteSighting(id: string) {
  const { error } = await supabase.from("sightings").delete().eq("id", id);
  if (error) throw error;
}

export async function setSightingVisibility(id: string, isPublic: boolean) {
  const { error } = await supabase.from("sightings").update({ is_public: isPublic }).eq("id", id);
  if (error) throw error;
}
