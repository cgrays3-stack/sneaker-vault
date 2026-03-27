import "server-only";
import { supabaseAdmin } from "./supabase-admin";

export async function getSneakers() {
  const { data, error } = await supabaseAdmin
    .from("sneakers")
    .select(`
      id,
      nickname,
      brand,
      model,
      official_product_name,
      common_nickname,
      colorway,
      size,
      sneaker_photos (
        image_url,
        photo_type,
        is_primary
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching sneakers:", error);
    return [];
  }

  return (data ?? []).map((sneaker: any) => {
    const primaryPhoto =
      sneaker.sneaker_photos?.find(
        (photo: any) => photo.is_primary && photo.photo_type === "shoe"
      ) ??
      sneaker.sneaker_photos?.find((photo: any) => photo.photo_type === "shoe") ??
      sneaker.sneaker_photos?.[0] ??
      null;

    return {
      id: sneaker.id,
      nickname: sneaker.nickname,
      brand: sneaker.brand,
      model: sneaker.model,
      official_product_name: sneaker.official_product_name,
      common_nickname: sneaker.common_nickname,
      colorway: sneaker.colorway,
      size: sneaker.size,
      image_url: primaryPhoto?.image_url ?? null,
    };
  });
}