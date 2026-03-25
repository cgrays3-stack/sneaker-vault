import { NextResponse } from "next/server";
import {
  getEbayErrorMessage,
  isEbayRateLimitError,
  searchGrailCandidates,
} from "@/lib/ebay";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";

    if (!q) {
      return NextResponse.json({
        ok: true,
        query: "",
        candidates: [],
      });
    }

    const candidates = await searchGrailCandidates(q);

    return NextResponse.json({
      ok: true,
      query: q,
      count: candidates.length,
      candidates,
    });
  } catch (error) {
    const message = getEbayErrorMessage(error);

    if (isEbayRateLimitError(error)) {
      return NextResponse.json(
        {
          ok: false,
          error: message,
          code: "EBAY_RATE_LIMIT",
          candidates: [],
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: message || "Failed to search grail candidates.",
        candidates: [],
      },
      { status: 500 }
    );
  }
}