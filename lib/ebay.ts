// lib/ebay.ts

type EbayTokenCache = {
  accessToken: string;
  expiresAt: number;
} | null;

let tokenCache: EbayTokenCache = null;

const EBAY_API_BASE = "https://api.ebay.com";
const EBAY_OAUTH_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const EBAY_SCOPE = "https://api.ebay.com/oauth/api_scope";

const TOKEN_EXPIRY_BUFFER_MS = 60_000;
const DEFAULT_LIMIT = 20;
const SOLD_DEFAULT_LIMIT = 50;
const GRAIL_SEARCH_LIMIT = 20;
const MAX_QUERIES = 5;
const EBAY_QUERY_DELAY_MS = 800;

const NEGATIVE_TITLE_PATTERNS = [
  /\blot\b/i,
  /\bbox only\b/i,
  /\breplacement box\b/i,
  /\blaces only\b/i,
  /\blace only\b/i,
  /\bcustom\b/i,
  /\breplica\b/i,
  /\binspired\b/i,
  /\bread description\b/i,
  /\bbeater\b/i,
  /\bdamaged\b/i,
  /\bparts\b/i,
  /\brepair\b/i,
  /\brestore\b/i,
  /\bempty box\b/i,
  /\bua\b/i,
];

const HARD_EXCLUDE_PATTERNS = [
  /\bbox only\b/i,
  /\breplacement box\b/i,
  /\blaces only\b/i,
  /\blace only\b/i,
  /\breplica\b/i,
  /\binspired\b/i,
  /\bparts\b/i,
  /\bempty box\b/i,
];

export type MarketBasis = "used" | "new";

export type SneakerMarketInput = {
  brand: string | null;
  model: string | null;
  colorway: string | null;
  sku: string | null;
  size: string | null;
  condition?: string | null;
  officialProductName?: string | null;
  commonNickname?: string | null;
};

export type EbayItemSummary = {
  itemId: string;
  title: string;
  price: {
    value: string;
    currency: string;
  };
  condition?: string;
  itemWebUrl?: string;
  image?: {
    imageUrl?: string;
  };
  shippingOptions?: Array<{
    shippingCostType?: string;
    shippingCost?: {
      value?: string;
      currency?: string;
    };
  }>;
};

type EbaySearchResponse = {
  total?: number;
  itemSummaries?: EbayItemSummary[];
};

export type MarketSampleListing = {
  itemId: string;
  title: string;
  price: number;
  currency: string;
  condition: string | null;
  itemWebUrl: string | null;
  imageUrl: string | null;
};

export type MarketEstimate = {
  source: "ebay-browse-active";
  marketBasis: MarketBasis;
  searchQuery: string;
  compCount: number;
  confidence: "low" | "medium" | "high";
  prices: {
    low: number | null;
    median: number | null;
    high: number | null;
  };
  sampleListings: MarketSampleListing[];
  emptyReason?: string;
  debug?: {
    queriesTried: string[];
    rawResultCount: number;
    keptCount: number;
    topTitles: string[];
    queryErrors?: Array<{
      query: string;
      message: string;
      isRateLimit: boolean;
    }>;
    partialFailure?: boolean;
  };
};

export type GrailSearchCandidate = {
  itemId: string;
  title: string;
  itemWebUrl: string | null;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
  condition: string | null;
  inferred: {
    brand: string | null;
    model: string | null;
    colorway: string | null;
    sku: string | null;
    officialProductName: string | null;
    commonNickname: string | null;
  };
};

export type SoldMarketSampleListing = {
  itemId: string;
  title: string;
  price: number;
  currency: string;
  condition: string | null;
  itemWebUrl: string | null;
  imageUrl: string | null;
  endTime: string | null;
  score: number;
};

export type SoldMarketEstimate = {
  source: "ebay-sold-completed";
  marketBasis: MarketBasis;
  searchQuery: string;
  compCount: number;
  confidence: "low" | "medium" | "high";
  prices: {
    low: number | null;
    median: number | null;
    high: number | null;
  };
  sampleListings: SoldMarketSampleListing[];
  emptyReason?: string;
  debug?: {
    queriesTried: string[];
    rawResultCount: number;
    keptCount: number;
    topTitles: string[];
    queryErrors?: Array<{
      query: string;
      message: string;
      isRateLimit: boolean;
    }>;
    partialFailure?: boolean;
  };
};

type FindingPrice = {
  __value__?: string;
  "@currencyId"?: string;
};

type FindingCompletedItem = {
  itemId?: [string];
  title?: [string];
  viewItemURL?: [string];
  galleryURL?: [string];
  sellingStatus?: Array<{
    currentPrice?: FindingPrice[];
    convertedCurrentPrice?: FindingPrice[];
    sellingState?: [string];
  }>;
  listingInfo?: Array<{
    endTime?: [string];
    listingType?: [string];
  }>;
  condition?: Array<{
    conditionDisplayName?: [string];
    conditionId?: [string];
  }>;
  shippingInfo?: Array<{
    shippingServiceCost?: FindingPrice[];
  }>;
};

type FindingCompletedResponse = {
  findCompletedItemsResponse?: Array<{
    ack?: [string];
    searchResult?: Array<{
      "@count"?: string;
      item?: FindingCompletedItem[];
    }>;
    errorMessage?: Array<unknown>;
  }>;
};

type SoldCapableItem = EbayItemSummary & {
  endTime?: string;
};

class EbayApiError extends Error {
  status?: number;
  body?: unknown;

  constructor(message: string, status?: number, body?: unknown) {
    super(message);
    this.name = "EbayApiError";
    this.status = status;
    this.body = body;
  }
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getEbayAppId(): string {
  return process.env.EBAY_APP_ID || getRequiredEnv("EBAY_CLIENT_ID");
}

function isTokenValid(cache: EbayTokenCache): cache is NonNullable<EbayTokenCache> {
  return !!cache && Date.now() < cache.expiresAt - TOKEN_EXPIRY_BUFFER_MS;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchEbayAccessToken(): Promise<string> {
  if (isTokenValid(tokenCache)) {
    return tokenCache.accessToken;
  }

  const clientId = getRequiredEnv("EBAY_CLIENT_ID");
  const clientSecret = getRequiredEnv("EBAY_CLIENT_SECRET");

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: EBAY_SCOPE,
  });

  const response = await fetch(EBAY_OAUTH_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as
    | { access_token?: string; expires_in?: number; error?: string; error_description?: string }
    | null;

  if (!response.ok || !data?.access_token || !data?.expires_in) {
    throw new EbayApiError(
      data?.error_description || data?.error || "Failed to fetch eBay access token",
      response.status,
      data,
    );
  }

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return tokenCache.accessToken;
}

async function ebayFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await fetchEbayAccessToken();

  const response = await fetch(`${EBAY_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (response.status === 401) {
    tokenCache = null;

    const retryToken = await fetchEbayAccessToken();
    const retryResponse = await fetch(`${EBAY_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${retryToken}`,
        Accept: "application/json",
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });

    if (!retryResponse.ok) {
      const retryBody = await retryResponse.json().catch(() => null);
      throw new EbayApiError(
        "eBay request failed after token refresh",
        retryResponse.status,
        retryBody,
      );
    }

    return (await retryResponse.json()) as T;
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new EbayApiError("eBay request failed", response.status, errorBody);
  }

  return (await response.json()) as T;
}

async function ebayFindingFetch<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await response.text();

  let parsedBody: unknown = null;
  try {
    parsedBody = text ? JSON.parse(text) : null;
  } catch {
    parsedBody = text;
  }

  if (!response.ok) {
    throw new EbayApiError(
      `eBay Finding API request failed (${response.status})`,
      response.status,
      parsedBody,
    );
  }

  return parsedBody as T;
}

function cleanPart(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length ? trimmed : null;
}

function extractNumericSize(size: string | null | undefined): number | null {
  if (!size) return null;
  const match = size.match(/(\d{1,2}(?:\.\d)?)/);
  return match ? Number(match[1]) : null;
}

function sizeLooksYouth(size: string | null | undefined): boolean {
  if (!size) return false;
  return /\b(gs|grade school|ps|preschool|td|toddler|y)\b/i.test(size);
}

function extractTitleSizes(title: string): number[] {
  const matches = [...title.matchAll(/\b(?:size|sz|us)?\s*(\d{1,2}(?:\.\d)?)\b/gi)];
  return matches
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));
}

function titleMatchesPreferredSize(title: string, preferredSize: number): boolean {
  const sizes = extractTitleSizes(title);

  if (!sizes.length) {
    return true;
  }

  return sizes.some((size) => Math.abs(size - preferredSize) < 0.001);
}

function normalizeTokens(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .toLowerCase()
    .split(/[\s,/()\-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = cleanPart(value);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

function normalizeCondition(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function inferBrandFromTitle(title: string): string | null {
  const match =
    /\b(nike|air jordan|jordan|adidas|new balance|asics|puma|reebok|yeezy|converse|vans|saucony)\b/i.exec(
      title,
    )?.[1] ?? null;

  if (!match) return null;
  if (/^air jordan$/i.test(match)) return "Jordan";
  return match
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/^Nike$/i, "Nike")
    .replace(/^Jordan$/i, "Jordan")
    .replace(/^Adidas$/i, "Adidas")
    .replace(/^Asics$/i, "ASICS")
    .replace(/^Yeezy$/i, "Yeezy");
}

function inferModelFromTitle(title: string): string | null {
  const patterns = [
    /\b(jordan\s+1\b(?:\s+(?:retro|retro high|retro low|retro mid|low|mid|high|og))?)/i,
    /\b(jordan\s+2\b(?:\s+(?:retro|low|high|og))?)/i,
    /\b(jordan\s+3\b(?:\s+(?:retro|og))?)/i,
    /\b(jordan\s+4\b(?:\s+(?:retro|og))?)/i,
    /\b(jordan\s+5\b(?:\s+(?:retro|og))?)/i,
    /\b(jordan\s+6\b(?:\s+(?:retro|og))?)/i,
    /\b(jordan\s+11\b(?:\s+(?:retro|low|og))?)/i,
    /\b(dunk\s+low)\b/i,
    /\b(dunk\s+high)\b/i,
    /\b(sb\s+dunk\s+low)\b/i,
    /\b(sb\s+dunk\s+high)\b/i,
    /\b(air\s+force\s+1)\b/i,
    /\b(air\s+max\s+1)\b/i,
    /\b(air\s+max\s+90)\b/i,
    /\b(air\s+max\s+95)\b/i,
    /\b(air\s+max\s+97)\b/i,
    /\b(air\s+trainer\s+1)\b/i,
    /\b(blazer\s+mid)\b/i,
    /\b(blazer\s+low)\b/i,
    /\b(yeezy\s+boost\s+350)\b/i,
    /\b(yeezy\s+boost\s+700)\b/i,
    /\b(9060)\b/i,
    /\b(2002r)\b/i,
    /\b(990v\d)\b/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(title);
    if (match?.[1]) {
      return match[1]
        .replace(/\b\w/g, (char) => char.toUpperCase())
        .replace(/^Sb /, "SB ")
        .replace(/^Air /, "Air ")
        .replace(/^Yeezy /, "Yeezy ");
    }
  }

  return null;
}

function inferColorwayFromTitle(title: string, brand: string | null, model: string | null): string | null {
  let working = title;

  if (brand) {
    const brandRegex = new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig");
    working = working.replace(brandRegex, " ");
  }

  if (model) {
    const modelRegex = new RegExp(model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig");
    working = working.replace(modelRegex, " ");
  }

  working = working
    .replace(/\b(mens|men's|women's|womens|grade school|gs|ps|td|toddler|preschool)\b/gi, " ")
    .replace(/\bsize\s+\d{1,2}(?:\.\d)?\b/gi, " ")
    .replace(/\b\d{1,2}(?:\.\d)?\b/g, " ")
    .replace(/\b[A-Z0-9]{3,}-[A-Z0-9]{2,}\b/gi, " ")
    .replace(/[()[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!working) return null;

  const shortened = working.split(" / ")[0].trim();
  return shortened.length >= 3 ? shortened : null;
}

function inferNicknameFromTitle(title: string): string | null {
  const nicknamePatterns = [
    /\b(chicago|bred|royal|shadow|mocha|panda|concord|space jam|grape|fire red|military blue|lost and found|cactus jack|travis scott|fragment|off-white|union|parra|jarritos|samba|olive|black toe|laney|taxi|court purple|pine green|storm blue)\b/i,
  ];

  for (const pattern of nicknamePatterns) {
    const match = pattern.exec(title);
    if (match?.[1]) {
      return match[1]
        .split(/\s+/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ");
    }
  }

  return null;
}

function inferSneakerMetadataFromTitle(title: string) {
  const clean = title.replace(/\s+/g, " ").trim();
  const skuMatch = clean.match(/\b[A-Z0-9]{3,}-[A-Z0-9]{2,}\b/i);
  const brand = inferBrandFromTitle(clean);
  const model = inferModelFromTitle(clean);
  const colorway = inferColorwayFromTitle(clean, brand, model);
  const nickname = inferNicknameFromTitle(clean);

  return {
    brand,
    model,
    colorway,
    sku: skuMatch?.[0] ?? null,
    officialProductName: clean,
    commonNickname: nickname,
  };
}

export function getMarketBasis(input: Pick<SneakerMarketInput, "condition">): MarketBasis {
  const condition = normalizeCondition(input.condition);

  if (
    condition === "deadstock" ||
    condition === "ds" ||
    condition === "new" ||
    condition === "brand new" ||
    condition === "new with box" ||
    condition === "new in box" ||
    condition === "nwb"
  ) {
    return "new";
  }

  return "used";
}

function buildSearchQueries(input: SneakerMarketInput): string[] {
  const brand = cleanPart(input.brand);
  const model = cleanPart(input.model);
  const colorway = cleanPart(input.colorway);
  const sku = cleanPart(input.sku);
  const officialProductName = cleanPart(input.officialProductName);
  const commonNickname = cleanPart(input.commonNickname);

  const queries = uniqueStrings([
    sku,
    sku && brand ? `${brand} ${sku}` : null,
    sku && model ? `${model} ${sku}` : null,
    sku && brand && model ? `${brand} ${model} ${sku}` : null,

    brand && model && commonNickname ? `${brand} ${model} ${commonNickname}` : null,
    brand && model && colorway ? `${brand} ${model} ${colorway}` : null,
    brand && officialProductName ? `${brand} ${officialProductName}` : null,

    officialProductName,
    commonNickname && model ? `${model} ${commonNickname}` : null,
    commonNickname && brand ? `${brand} ${commonNickname}` : null,
    commonNickname,

    brand && model ? `${brand} ${model}` : null,
  ]);

  if (sku) {
    return queries.slice(0, 2);
  }

  return queries.slice(0, MAX_QUERIES);
}

function titleIncludesAllTokens(title: string, tokens: string[]): boolean {
  const lower = title.toLowerCase();
  return tokens.every((token) => lower.includes(token.toLowerCase()));
}

function tokenizeForMatching(input: SneakerMarketInput): {
  skuTokens: string[];
  brandTokens: string[];
  modelTokens: string[];
  colorwayTokens: string[];
  officialProductNameTokens: string[];
  nicknameTokens: string[];
} {
  return {
    skuTokens: normalizeTokens(input.sku),
    brandTokens: normalizeTokens(input.brand),
    modelTokens: normalizeTokens(input.model),
    colorwayTokens: normalizeTokens(input.colorway),
    officialProductNameTokens: normalizeTokens(input.officialProductName),
    nicknameTokens: normalizeTokens(input.commonNickname),
  };
}

function shouldHardExclude(item: EbayItemSummary): boolean {
  const title = item.title || "";
  return HARD_EXCLUDE_PATTERNS.some((pattern) => pattern.test(title));
}

function getShippingCost(item: EbayItemSummary): number {
  const option = item.shippingOptions?.[0];
  const value = option?.shippingCost?.value;
  const parsed = value ? Number(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function getTotalPrice(item: EbayItemSummary): number | null {
  const itemPrice = item.price?.value ? Number(item.price.value) : NaN;
  if (!Number.isFinite(itemPrice)) return null;

  return round2(itemPrice + getShippingCost(item));
}

function scoreItem(item: EbayItemSummary, input: SneakerMarketInput, basis: MarketBasis): number {
  const title = item.title || "";
  const lower = title.toLowerCase();

  const {
    skuTokens,
    brandTokens,
    modelTokens,
    colorwayTokens,
    officialProductNameTokens,
    nicknameTokens,
  } = tokenizeForMatching(input);

  let score = 0;

  if (item.image?.imageUrl) score += 10;
  if (item.itemWebUrl) score += 2;

  if (skuTokens.length > 0) {
    const skuMatches = skuTokens.filter((token) => lower.includes(token)).length;
    score += skuMatches * 22;

    if (titleIncludesAllTokens(title, skuTokens)) score += 40;
  }

  const brandMatches = brandTokens.filter((token) => lower.includes(token)).length;
  const modelMatches = modelTokens.filter((token) => lower.includes(token)).length;
  const colorMatches = colorwayTokens.filter((token) => lower.includes(token)).length;
  const nameMatches = officialProductNameTokens.filter((token) => lower.includes(token)).length;
  const nicknameMatches = nicknameTokens.filter((token) => lower.includes(token)).length;

  score += brandMatches * 6;
  score += modelMatches * 10;
  score += colorMatches * 5;
  score += nameMatches * 5;
  score += nicknameMatches * 9;

  if (nicknameTokens.length > 0 && titleIncludesAllTokens(title, nicknameTokens)) {
    score += 14;
  }

  const targetSize = extractNumericSize(input.size);
  const inputIsYouth = sizeLooksYouth(input.size);
  const titleHasYouthMarkers = /\b(gs|grade school|ps|preschool|td|toddler|kids|youth)\b/i.test(title);

  if (targetSize !== null) {
    const titleSizeMatch = title.match(/\b(?:size|sz|us)?\s*(\d{1,2}(?:\.\d)?)\b/i);
    const titleSize = titleSizeMatch ? Number(titleSizeMatch[1]) : null;

    if (titleSize !== null) {
      const delta = Math.abs(titleSize - targetSize);

      if (delta === 0) score += 18;
      else if (delta <= 0.5) score += 8;
      else if (delta <= 1) score += 2;
      else if (delta >= 2) score -= 18;
    } else {
      score -= 3;
    }
  }

  if (!inputIsYouth && titleHasYouthMarkers) score -= 35;
  if (inputIsYouth && titleHasYouthMarkers) score += 10;

  const condition = (item.condition ?? "").toLowerCase();

  const titleLooksNew = /\b(new|brand new|new with box|nib|nwb)\b/i.test(title);
  const titleLooksUsed = /\b(used|pre-owned|preowned|worn)\b/i.test(title);

  if (basis === "used") {
    if (condition.includes("used") || condition.includes("pre-owned")) score += 14;
    if (titleLooksUsed) score += 10;

    if (condition.includes("new")) score -= 20;
    if (titleLooksNew) score -= 12;
  }

  if (basis === "new") {
    if (condition.includes("new")) score += 12;
    if (titleLooksNew) score += 10;

    if (condition.includes("used") || condition.includes("pre-owned")) score -= 18;
    if (titleLooksUsed) score -= 10;
  }

  if (condition.includes("for parts")) score -= 40;

  for (const pattern of NEGATIVE_TITLE_PATTERNS) {
    if (pattern.test(title)) {
      score -= 18;
    }
  }

  return score;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return round2((sorted[mid - 1] + sorted[mid]) / 2);
  }

  return round2(sorted[mid]);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function computeConfidence(
  input: SneakerMarketInput,
  compCount: number,
): "low" | "medium" | "high" {
  const hasSku = !!cleanPart(input.sku);
  const hasNickname = !!cleanPart(input.commonNickname);
  const hasModel = !!cleanPart(input.model);

  if (hasSku && compCount >= 8) return "high";
  if (hasSku && compCount >= 4) return "medium";

  if ((hasNickname || hasModel) && compCount >= 16) return "high";
  if ((hasNickname || hasModel) && compCount >= 10) return "medium";

  return "low";
}

function buildBrowseSearchPath(query: string, limit: number, basis?: MarketBasis): string {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    sort: "best_match",
    fieldgroups: "MATCHING_ITEMS",
  });

  if (basis) {
    const filters = [
      "buyingOptions:{FIXED_PRICE}",
      `conditions:{${basis === "used" ? "USED" : "NEW"}}`,
    ];
    params.set("filter", filters.join(","));
  }

  return `/buy/browse/v1/item_summary/search?${params.toString()}`;
}

function buildFindingCompletedSearchUrl(query: string, limit: number, basis: MarketBasis): string {
  const appId = getEbayAppId();

  const params = new URLSearchParams({
    "OPERATION-NAME": "findCompletedItems",
    "SERVICE-VERSION": "1.13.0",
    "SECURITY-APPNAME": appId,
    "RESPONSE-DATA-FORMAT": "JSON",
    "REST-PAYLOAD": "true",
    keywords: query,
    "paginationInput.entriesPerPage": String(limit),
    sortOrder: "EndTimeSoonest",
  });

  params.append("itemFilter(0).name", "SoldItemsOnly");
  params.append("itemFilter(0).value", "true");

  params.append("itemFilter(1).name", "HideDuplicateItems");
  params.append("itemFilter(1).value", "true");

  if (basis === "used") {
    params.append("itemFilter(2).name", "Condition");
    params.append("itemFilter(2).value", "3000");
  } else {
    params.append("itemFilter(2).name", "Condition");
    params.append("itemFilter(2).value", "1000");
  }

  return `https://svcs.ebay.com/services/search/FindingService/v1?${params.toString()}`;
}

async function searchQuery(query: string, basis: MarketBasis): Promise<EbayItemSummary[]> {
  const data = await ebayFetch<EbaySearchResponse>(
    buildBrowseSearchPath(query, DEFAULT_LIMIT, basis),
  );
  return data.itemSummaries ?? [];
}

export async function searchGrailCandidates(query: string): Promise<GrailSearchCandidate[]> {
  const cleaned = `${query.trim()} size 13`.trim();
  if (!cleaned) return [];

  const data = await ebayFetch<EbaySearchResponse>(
    buildBrowseSearchPath(cleaned, GRAIL_SEARCH_LIMIT),
  );

  const items = data.itemSummaries ?? [];
  const preferredSize = 13;

  const candidates = items
    .filter((item) => !!item.itemId && !!item.title)
    .filter((item) => !shouldHardExclude(item))
    .filter((item) => titleMatchesPreferredSize(item.title, preferredSize))
    .map((item) => {
      const inferred = inferSneakerMetadataFromTitle(item.title);

      let candidateScore = 0;
      if (item.image?.imageUrl) candidateScore += 10;
      if (item.price?.value) candidateScore += 5;
      if (inferred.sku) candidateScore += 10;
      if (inferred.brand) candidateScore += 6;
      if (inferred.model) candidateScore += 8;
      if (inferred.commonNickname) candidateScore += 6;

      const queryTokens = normalizeTokens(cleaned);
      const titleLower = item.title.toLowerCase();
      const matchedTokens = queryTokens.filter((token) => titleLower.includes(token)).length;
      candidateScore += matchedTokens * 5;

      return {
        candidateScore,
        candidate: {
          itemId: item.itemId,
          title: item.title,
          itemWebUrl: item.itemWebUrl ?? null,
          imageUrl: item.image?.imageUrl ?? null,
          price: item.price?.value ? Number(item.price.value) : null,
          currency: item.price?.currency ?? null,
          condition: item.condition ?? null,
          inferred,
        } satisfies GrailSearchCandidate,
      };
    })
    .sort((a, b) => b.candidateScore - a.candidateScore)
    .slice(0, 20)
    .map((entry) => entry.candidate);

  return candidates;
}

function normalizeFindingCompletedItem(item: FindingCompletedItem): SoldCapableItem | null {
  const itemId = item.itemId?.[0];
  const title = item.title?.[0];
  const itemWebUrl = item.viewItemURL?.[0];
  const imageUrl = item.galleryURL?.[0];

  const priceValue =
    item.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.__value__ ??
    item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__;

  const currency =
    item.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.["@currencyId"] ??
    item.sellingStatus?.[0]?.currentPrice?.[0]?.["@currencyId"] ??
    "USD";

  if (!itemId || !title || !priceValue) {
    return null;
  }

  const condition = item.condition?.[0]?.conditionDisplayName?.[0];
  const shippingValue = item.shippingInfo?.[0]?.shippingServiceCost?.[0]?.__value__;
  const endTime = item.listingInfo?.[0]?.endTime?.[0];

  return {
    itemId,
    title,
    price: {
      value: priceValue,
      currency,
    },
    condition,
    itemWebUrl,
    image: imageUrl ? { imageUrl } : undefined,
    shippingOptions: shippingValue
      ? [
          {
            shippingCost: {
              value: shippingValue,
              currency,
            },
          },
        ]
      : undefined,
    endTime,
  };
}

async function searchSoldQuery(query: string, basis: MarketBasis): Promise<SoldCapableItem[]> {
  const url = buildFindingCompletedSearchUrl(query, SOLD_DEFAULT_LIMIT, basis);
  const data = await ebayFindingFetch<FindingCompletedResponse>(url);

  const items = data.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item ?? [];

  return items
    .map((item) => normalizeFindingCompletedItem(item))
    .filter((item): item is SoldCapableItem => item !== null);
}

function dedupeItems<T extends { itemId: string }>(items: T[]): T[] {
  const map = new Map<string, T>();

  for (const item of items) {
    if (!item.itemId) continue;
    if (!map.has(item.itemId)) {
      map.set(item.itemId, item);
    }
  }

  return Array.from(map.values());
}

function trimmedPriceBand(values: number[]): {
  low: number | null;
  median: number | null;
  high: number | null;
} {
  if (!values.length) {
    return { low: null, median: null, high: null };
  }

  const sorted = [...values].sort((a, b) => a - b);

  let working = sorted;
  if (sorted.length >= 5) {
    working = sorted.slice(1, sorted.length - 1);
  }

  return {
    low: working.length ? round2(working[0]) : null,
    median: median(working),
    high: working.length ? round2(working[working.length - 1]) : null,
  };
}

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return round2(sorted[lower]);

  const interpolated =
    sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);

  return round2(interpolated);
}

function removeOutliersByIqr(values: number[]): number[] {
  if (values.length < 4) return values;

  const sorted = [...values].sort((a, b) => a - b);
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);

  if (q1 === null || q3 === null) return sorted;

  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;

  return sorted.filter((value) => value >= lower && value <= upper);
}

function soldPriceBand(values: number[]): {
  low: number | null;
  median: number | null;
  high: number | null;
} {
  if (!values.length) {
    return { low: null, median: null, high: null };
  }

  const filtered = removeOutliersByIqr(values);

  return {
    low: percentile(filtered, 0.25),
    median: percentile(filtered, 0.5),
    high: percentile(filtered, 0.75),
  };
}

function getMinimumScoreForSoldComp(input: SneakerMarketInput): number {
  if (cleanPart(input.sku)) return 20;
  if (cleanPart(input.model) && cleanPart(input.commonNickname)) return 12;
  return 8;
}

async function runQueriesSequentially<T>(
  queries: string[],
  runner: (query: string) => Promise<T[]>,
): Promise<{
  results: T[][];
  queryErrors: Array<{
    query: string;
    message: string;
    isRateLimit: boolean;
  }>;
}> {
  const results: T[][] = [];
  const queryErrors: Array<{
    query: string;
    message: string;
    isRateLimit: boolean;
  }> = [];

  for (let index = 0; index < queries.length; index += 1) {
    const query = queries[index];

    try {
      const queryResults = await runner(query);
      results.push(queryResults);
    } catch (error) {
      const isRateLimit = isEbayRateLimitError(error);

      queryErrors.push({
        query,
        message: getEbayErrorMessage(error),
        isRateLimit,
      });

      if (isRateLimit) {
        break;
      }
    }

    if (index < queries.length - 1) {
      await sleep(EBAY_QUERY_DELAY_MS);
    }
  }

  return { results, queryErrors };
}

export async function searchActiveListings(input: SneakerMarketInput): Promise<MarketEstimate> {
  const queries = buildSearchQueries(input);
  const marketBasis = getMarketBasis(input);

  if (!queries.length) {
    return {
      source: "ebay-browse-active",
      marketBasis,
      searchQuery: "",
      compCount: 0,
      confidence: "low",
      prices: { low: null, median: null, high: null },
      sampleListings: [],
      emptyReason: "Missing enough sneaker data to search eBay.",
      debug: {
        queriesTried: [],
        rawResultCount: 0,
        keptCount: 0,
        topTitles: [],
        queryErrors: [],
        partialFailure: false,
      },
    };
  }

  const { results, queryErrors } = await runQueriesSequentially(
    queries,
    (query) => searchQuery(query, marketBasis),
  );

  const rawItems = dedupeItems(results.flat());

  const scored = rawItems
    .filter((item) => !!item.title && !!item.price?.value)
    .filter((item) => !shouldHardExclude(item))
    .map((item) => ({
      item,
      score: scoreItem(item, input, marketBasis),
      totalPrice: getTotalPrice(item),
    }))
    .filter(
      (entry): entry is { item: EbayItemSummary; score: number; totalPrice: number } =>
        entry.totalPrice !== null,
    )
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score);

  const kept = scored.slice(0, 12);

  if (!kept.length) {
    return {
      source: "ebay-browse-active",
      marketBasis,
      searchQuery: queries.join(" | "),
      compCount: 0,
      confidence: "low",
      prices: { low: null, median: null, high: null },
      sampleListings: [],
      emptyReason: `No relevant ${marketBasis} active listings found.`,
      debug: {
        queriesTried: queries,
        rawResultCount: rawItems.length,
        keptCount: 0,
        topTitles: rawItems.slice(0, 5).map((item) => item.title),
        queryErrors,
        partialFailure: queryErrors.length > 0,
      },
    };
  }

  const prices = kept.map((entry) => entry.totalPrice);
  const bands = trimmedPriceBand(prices);

  return {
    source: "ebay-browse-active",
    marketBasis,
    searchQuery: queries.join(" | "),
    compCount: kept.length,
    confidence: computeConfidence(input, kept.length),
    prices: bands,
    sampleListings: kept.slice(0, 6).map(({ item, totalPrice }) => ({
      itemId: item.itemId,
      title: item.title,
      price: round2(totalPrice),
      currency: item.price.currency,
      condition: item.condition ?? null,
      itemWebUrl: item.itemWebUrl ?? null,
      imageUrl: item.image?.imageUrl ?? null,
    })),
    debug: {
      queriesTried: queries,
      rawResultCount: rawItems.length,
      keptCount: kept.length,
      topTitles: kept.slice(0, 5).map((entry) => entry.item.title),
      queryErrors,
      partialFailure: queryErrors.length > 0,
    },
  };
}

export async function searchSoldListings(
  input: SneakerMarketInput,
): Promise<SoldMarketEstimate> {
  const queries = buildSearchQueries(input);
  const marketBasis = getMarketBasis(input);

  if (!queries.length) {
    return {
      source: "ebay-sold-completed",
      marketBasis,
      searchQuery: "",
      compCount: 0,
      confidence: "low",
      prices: { low: null, median: null, high: null },
      sampleListings: [],
      emptyReason: "Missing enough sneaker data to search sold eBay listings.",
      debug: {
        queriesTried: [],
        rawResultCount: 0,
        keptCount: 0,
        topTitles: [],
        queryErrors: [],
        partialFailure: false,
      },
    };
  }

  const { results, queryErrors } = await runQueriesSequentially(
    queries,
    (query) => searchSoldQuery(query, marketBasis),
  );

  const rawItems = dedupeItems(results.flat());
  const minScore = getMinimumScoreForSoldComp(input);

  const scored = rawItems
    .filter((item) => !!item.title && !!item.price?.value)
    .filter((item) => !shouldHardExclude(item))
    .map((item) => ({
      item,
      score: scoreItem(item, input, marketBasis),
      totalPrice: getTotalPrice(item),
    }))
    .filter(
      (entry): entry is { item: SoldCapableItem; score: number; totalPrice: number } =>
        entry.totalPrice !== null,
    )
    .filter((entry) => entry.score >= minScore)
    .sort((a, b) => b.score - a.score);

  const kept = scored.slice(0, 20);

  if (!kept.length) {
    return {
      source: "ebay-sold-completed",
      marketBasis,
      searchQuery: queries.join(" | "),
      compCount: 0,
      confidence: "low",
      prices: { low: null, median: null, high: null },
      sampleListings: [],
      emptyReason: `No relevant ${marketBasis} sold listings found.`,
      debug: {
        queriesTried: queries,
        rawResultCount: rawItems.length,
        keptCount: 0,
        topTitles: rawItems.slice(0, 5).map((item) => item.title),
        queryErrors,
        partialFailure: queryErrors.length > 0,
      },
    };
  }

  const prices = kept.map((entry) => entry.totalPrice);
  const bands = soldPriceBand(prices);

  return {
    source: "ebay-sold-completed",
    marketBasis,
    searchQuery: queries.join(" | "),
    compCount: kept.length,
    confidence: computeConfidence(input, kept.length),
    prices: bands,
    sampleListings: kept.slice(0, 8).map(({ item, totalPrice, score }) => ({
      itemId: item.itemId,
      title: item.title,
      price: round2(totalPrice),
      currency: item.price.currency,
      condition: item.condition ?? null,
      itemWebUrl: item.itemWebUrl ?? null,
      imageUrl: item.image?.imageUrl ?? null,
      endTime: item.endTime ?? null,
      score,
    })),
    debug: {
      queriesTried: queries,
      rawResultCount: rawItems.length,
      keptCount: kept.length,
      topTitles: kept.slice(0, 5).map((entry) => entry.item.title),
      queryErrors,
      partialFailure: queryErrors.length > 0,
    },
  };
}

export function isEbayRateLimitError(error: unknown): boolean {
  if (error instanceof EbayApiError && error.status === 429) {
    return true;
  }

  if (
    error instanceof EbayApiError &&
    typeof error.body === "object" &&
    error.body !== null &&
    JSON.stringify(error.body).includes("RateLimiter")
  ) {
    return true;
  }

  return false;
}

export function getEbayErrorMessage(error: unknown): string {
  if (error instanceof EbayApiError) {
    if (isEbayRateLimitError(error)) return "eBay rate limit reached. Try again shortly.";
    if (error.status === 401) return "eBay authentication failed.";

    if (typeof error.body === "string" && error.body.trim()) {
      return `${error.message}: ${error.body}`;
    }

    if (error.body && typeof error.body === "object") {
      return `${error.message}: ${JSON.stringify(error.body)}`;
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown eBay error.";
}

export async function searchActiveListingsForBothConditions(
  input: SneakerMarketInput,
) {
  const [usedEstimate, newEstimate] = await Promise.all([
    searchActiveListings({
      ...input,
      condition: "Used",
    }),
    searchActiveListings({
      ...input,
      condition: "New",
    }),
  ]);

  return {
    used: usedEstimate,
    new: newEstimate,
  };
}

export async function searchSoldListingsForBothConditions(
  input: SneakerMarketInput,
) {
  const [usedEstimate, newEstimate] = await Promise.all([
    searchSoldListings({
      ...input,
      condition: "Used",
    }),
    searchSoldListings({
      ...input,
      condition: "New",
    }),
  ]);

  return {
    used: usedEstimate,
    new: newEstimate,
  };
}

type GoogleImageSearchItem = {
  link?: string;
  title?: string;
  image?: {
    thumbnailLink?: string;
    contextLink?: string;
  };
  displayLink?: string;
};

type GoogleImageSearchResponse = {
  items?: GoogleImageSearchItem[];
};

function buildGrailImageQuery(input: {
  brand?: string | null;
  model?: string | null;
  colorway?: string | null;
  sku?: string | null;
  officialProductName?: string | null;
  commonNickname?: string | null;
}) {
  const parts = uniqueStrings([
    input.sku,
    input.officialProductName,
    input.brand && input.model ? `${input.brand} ${input.model}` : null,
    input.colorway,
    input.commonNickname,
    "sneaker",
  ]);

  return parts.join(" ");
}

export async function searchWebImageForGrail(input: {
  brand?: string | null;
  model?: string | null;
  colorway?: string | null;
  sku?: string | null;
  officialProductName?: string | null;
  commonNickname?: string | null;
}): Promise<string | null> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;

  if (!apiKey || !cx) {
    return null;
  }

  const query = buildGrailImageQuery(input);
  if (!query) return null;

  const params = new URLSearchParams({
    key: apiKey,
    cx,
    q: query,
    searchType: "image",
    num: "5",
    safe: "active",
    imgSize: "large",
  });

  const response = await fetch(
    `https://www.googleapis.com/customsearch/v1?${params.toString()}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as GoogleImageSearchResponse;
  const items = data.items ?? [];

  for (const item of items) {
    if (item.link) {
      return item.link;
    }
  }

  return null;
}