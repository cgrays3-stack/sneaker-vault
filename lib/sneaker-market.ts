export type SneakerMarketInput = {
  id: string;
  nickname: string;
  brand: string | null;
  model: string | null;
  official_product_name: string | null;
  common_nickname: string | null;
  colorway: string | null;
  sku: string | null;
  size: string | null;
  condition: string | null;
};

export type EbayListing = {
  itemId: string;
  title: string;
  itemWebUrl: string;
  imageUrl: string | null;
  priceValue: number;
  priceCurrency: string;
  condition: string | null;
};

export type NicknameSource = {
  title: string;
  url: string;
};

function compact(parts: Array<string | null | undefined>) {
  return parts.map((x) => (x ?? "").trim()).filter(Boolean);
}

export function buildSearchQuery(shoe: SneakerMarketInput) {
  const parts = compact([
    shoe.brand,
    shoe.model,
    shoe.colorway,
    shoe.sku,
    shoe.size ? `size ${shoe.size}` : null,
  ]);

  if (parts.length > 0) return parts.join(" ");

  return compact([
    shoe.nickname,
    shoe.official_product_name,
    shoe.common_nickname,
  ]).join(" ");
}

export function buildNicknamePrompt(shoe: SneakerMarketInput) {
  return [
    "Identify the sneaker nickname if one is commonly used.",
    "Be conservative. If there is no clear nickname, return null.",
    "",
    `Nickname field: ${shoe.nickname}`,
    `Brand: ${shoe.brand ?? ""}`,
    `Model: ${shoe.model ?? ""}`,
    `Official product name: ${shoe.official_product_name ?? ""}`,
    `Common nickname: ${shoe.common_nickname ?? ""}`,
    `Colorway: ${shoe.colorway ?? ""}`,
    `SKU: ${shoe.sku ?? ""}`,
  ].join("\n");
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function isRelevantListing(title: string, shoe: SneakerMarketInput) {
  const t = normalize(title);

  const sku = shoe.sku ? normalize(shoe.sku) : "";
  if (sku && t.includes(sku)) return true;

  const brandTokens = compact([shoe.brand])
    .flatMap((x) => normalize(x).split(" "))
    .filter((x) => x.length >= 3);

  const modelTokens = compact([shoe.model])
    .flatMap((x) => normalize(x).split(" "))
    .filter((x) => x.length >= 3)
    .slice(0, 2);

  const colorwayTokens = compact([shoe.colorway])
    .flatMap((x) => normalize(x).split(" "))
    .filter((x) => x.length >= 4)
    .slice(0, 2);

  const required = [...brandTokens, ...modelTokens];
  const requiredMatch =
    required.length === 0 || required.every((token) => t.includes(token));

  const colorwayMatch =
    colorwayTokens.length === 0 ||
    colorwayTokens.some((token) => t.includes(token));

  return requiredMatch && colorwayMatch;
}

export function summarizePrices(values: number[]) {
  if (values.length === 0) {
    return {
      low: null as number | null,
      median: null as number | null,
      high: null as number | null,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  const median =
    sorted.length % 2 === 1
      ? sorted[mid]
      : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));

  return {
    low: sorted[0],
    median,
    high: sorted[sorted.length - 1],
  };
}