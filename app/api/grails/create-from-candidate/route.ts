import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  getEbayErrorMessage,
  searchSoldListingsForBothConditions,
  searchWebImageForGrail,
} from "@/lib/ebay";

type CreateFromCandidateBody = {
  searchText: string;
  candidate: {
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
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateFromCandidateBody;
    const candidate = body.candidate;

    if (!candidate?.title) {
      return NextResponse.json(
        { ok: false, error: "Missing candidate title." },
        { status: 400 },
      );
    }

    const nickname = candidate.inferred.commonNickname || candidate.title;
    const officialProductName =
      candidate.inferred.officialProductName ?? candidate.title;
    const sku = candidate.inferred.sku ?? null;

    if (sku) {
      const { data: existingBySku } = await supabase
        .from("grails")
        .select("*")
        .eq("status", "active")
        .eq("sku", sku)
        .limit(1)
        .maybeSingle();

      if (existingBySku) {
        return NextResponse.json(
          {
            ok: false,
            code: "DUPLICATE_GRAIL",
            error: "That grail is already on your list.",
            grail: existingBySku,
          },
          { status: 409 },
        );
      }
    }

    if (!sku && officialProductName) {
      const { data: existingByName } = await supabase
        .from("grails")
        .select("*")
        .eq("status", "active")
        .ilike("official_product_name", officialProductName)
        .limit(1)
        .maybeSingle();

      if (existingByName) {
        return NextResponse.json(
          {
            ok: false,
            code: "DUPLICATE_GRAIL",
            error: "That grail is already on your list.",
            grail: existingByName,
          },
          { status: 409 },
        );
      }
    }

    const resolvedImageUrl =
      (await searchWebImageForGrail({
        brand: candidate.inferred.brand ?? null,
        model: candidate.inferred.model ?? null,
        colorway: candidate.inferred.colorway ?? null,
        sku,
        officialProductName,
        commonNickname: candidate.inferred.commonNickname ?? null,
      })) ?? candidate.imageUrl ?? null;

    const insertPayload = {
      nickname,
      brand: candidate.inferred.brand ?? null,
      model: candidate.inferred.model ?? null,
      official_product_name: officialProductName,
      common_nickname: candidate.inferred.commonNickname ?? null,
      colorway: candidate.inferred.colorway ?? null,
      sku,
      size: "13",
      desired_condition: null,
      target_price: null,
      max_price: null,
      priority: null,
      notes: null,
      image_url: resolvedImageUrl,
      status: "active",
    };

    const { data: grail, error: insertError } = await supabase
      .from("grails")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertError || !grail) {
      return NextResponse.json(
        {
          ok: false,
          error: insertError?.message || "Failed to create grail.",
        },
        { status: 500 },
      );
    }

    let updatedGrail = grail;
    let pricingWarning: string | null = null;

    try {
      const pricing = await searchSoldListingsForBothConditions({
        brand: grail.brand ?? null,
        model: grail.model ?? null,
        colorway: grail.colorway ?? null,
        sku: grail.sku ?? null,
        size: grail.size ?? null,
        condition: grail.desired_condition ?? null,
        officialProductName: grail.official_product_name ?? null,
        commonNickname: grail.common_nickname ?? null,
      });

      const { data: pricedGrail, error: updateError } = await supabase
        .from("grails")
        .update({
          used_sold_price_low: pricing.used.prices.low,
          used_sold_price_mid: pricing.used.prices.median,
          used_sold_price_high: pricing.used.prices.high,
          new_sold_price_low: pricing.new.prices.low,
          new_sold_price_mid: pricing.new.prices.median,
          new_sold_price_high: pricing.new.prices.high,
          used_sold_comp_count: pricing.used.compCount,
          new_sold_comp_count: pricing.new.compCount,
          used_sold_confidence: pricing.used.confidence,
          new_sold_confidence: pricing.new.confidence,
          sold_pricing_source: "ebay-sold-completed",
          sold_pricing_last_refreshed_at: new Date().toISOString(),
          sold_pricing_notes: {
            used: {
              searchQuery: pricing.used.searchQuery,
              emptyReason: pricing.used.emptyReason ?? null,
              debug: pricing.used.debug ?? null,
              sampleListings: pricing.used.sampleListings ?? [],
            },
            new: {
              searchQuery: pricing.new.searchQuery,
              emptyReason: pricing.new.emptyReason ?? null,
              debug: pricing.new.debug ?? null,
              sampleListings: pricing.new.sampleListings ?? [],
            },
          },
        })
        .eq("id", grail.id)
        .select("*")
        .single();

      if (!updateError && pricedGrail) {
        updatedGrail = pricedGrail;
      } else {
        pricingWarning =
          updateError?.message || "Pricing failed after grail creation.";
      }
    } catch (error) {
      pricingWarning = getEbayErrorMessage(error);
    }

    return NextResponse.json({
      ok: true,
      grail: updatedGrail,
      pricingWarning,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to create grail.",
      },
      { status: 500 },
    );
  }
}