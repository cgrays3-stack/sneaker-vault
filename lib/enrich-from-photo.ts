import {
  parseSneakerFromImageAndContext,
  type ParsedLabelResult,
  type SneakerContext,
} from "@/lib/parse-box-label";

export type SneakerPhoto = {
  image_url: string;
  is_primary: boolean;
  photo_type: string | null;
};

export type ParsedSneakerFields = ParsedLabelResult;

export type EnrichFromPhotoResult = {
  success: boolean;
  imageUsed: string | null;
  photoTypeUsed: string | null;
  rawText: string;
  parsed: ParsedSneakerFields;
  error?: string;
};

function normalizePhotoType(photoType: string | null | undefined): string {
  return (photoType ?? "").toLowerCase().trim();
}

function chooseBestPhoto(photos: SneakerPhoto[]): SneakerPhoto | null {
  if (!photos.length) return null;

  const normalized = photos.map((photo) => ({
    ...photo,
    normalizedType: normalizePhotoType(photo.photo_type),
  }));

  return (
    normalized.find((p) => p.normalizedType === "label") ||
    normalized.find((p) => p.normalizedType === "box-label") ||
    normalized.find((p) => p.normalizedType === "box_label") ||
    normalized.find((p) => p.normalizedType === "shoe") ||
    normalized.find((p) => p.normalizedType === "hero") ||
    normalized.find((p) => p.is_primary) ||
    normalized[0]
  );
}

export async function enrichFromBestPhoto(
  photos: SneakerPhoto[],
  context?: SneakerContext
): Promise<EnrichFromPhotoResult> {
  const bestPhoto = chooseBestPhoto(photos);

  if (!bestPhoto?.image_url) {
    return {
      success: false,
      imageUsed: null,
      photoTypeUsed: null,
      rawText: "",
      parsed: {
        brand: null,
        model: null,
        official_product_name: null,
        common_nickname: null,
        colorway: null,
        sku: null,
        size: null,
      },
      error: "No photo available for enrichment.",
    };
  }

  const parsed = await parseSneakerFromImageAndContext(
    bestPhoto.image_url,
    context
  );

  return {
    success: true,
    imageUsed: bestPhoto.image_url,
    photoTypeUsed: bestPhoto.photo_type ?? null,
    rawText: "[parsed from image + existing metadata]",
    parsed,
  };
}