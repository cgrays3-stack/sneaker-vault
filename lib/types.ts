export type Grail = {
  id: string;
  nickname: string;
  brand: string | null;
  model: string | null;
  official_product_name: string | null;
  common_nickname: string | null;
  colorway: string | null;
  sku: string | null;
  size: string | null;
  desired_condition: string | null;
  target_price: number | null;
  max_price: number | null;
  priority: number | null;
  notes: string | null;

  used_sold_price_low: number | null;
  used_sold_price_mid: number | null;
  used_sold_price_high: number | null;
  new_sold_price_low: number | null;
  new_sold_price_mid: number | null;
  new_sold_price_high: number | null;

  used_sold_comp_count: number | null;
  new_sold_comp_count: number | null;

  used_sold_confidence: string | null;
  new_sold_confidence: string | null;

  sold_pricing_last_refreshed_at: string | null;
  status: string | null;

  image_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};