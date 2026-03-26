// app/api/sneakers/[id]/market/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  getEbayErrorMessage,
  isEbayRateLimitError,
  searchActiveListings,
} from "@/lib/ebay";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type SneakerRow = {
  id: string;
  brand: string | null;
  model: string | null;
  colorway: string | null;
  sku: string | null;
  size: string | null;
  official_product_name: string | null;
  common_nickname: string | null;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          source: "ebay-browse-active",
          searchQuery: null,
          compCount: 0,
          confidence: "low",
          prices: { low: null, median: null, high: null },
          sampleListings: [],
          error: "Missing sneaker id.",
        },
        { status: 400 },
      );
    }

    const { data: sneaker, error } = await supabaseAdmin
      .from("sneakers")
      .select(
        `
          id,
          brand,
          model,
          colorway,
          sku,
          size,
          official_product_name,
          common_nickname
        `,
      )
      .eq("id", id)
      .single<SneakerRow>();

    if (error || !sneaker) {
      return NextResponse.json(
        {
          success: false,
          source: "ebay-browse-active",
          searchQuery: null,
          compCount: 0,
          confidence: "low",
          prices: { low: null, median: null, high: null },
          sampleListings: [],
          error: "Sneaker not found.",
        },
        { status: 404 },
      );
    }

    const estimate = await searchActiveListings({
      brand: sneaker.brand,
      model: sneaker.model,
      colorway: sneaker.colorway,
      sku: sneaker.sku,
      size: sneaker.size,
      officialProductName: sneaker.official_product_name,
      commonNickname: sneaker.common_nickname,
    });

    return NextResponse.json(
      {
        success: true,
        ...estimate,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "s-maxage=900, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    const message = getEbayErrorMessage(error);

    return NextResponse.json(
      {
        success: false,
        source: "ebay-browse-active",
        searchQuery: null,
        compCount: 0,
        confidence: "low",
        prices: { low: null, median: null, high: null },
        sampleListings: [],
        error: message,
      },
      { status: isEbayRateLimitError(error) ? 429 : 500 },
    );
  }
}