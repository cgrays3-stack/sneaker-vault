import { NextRequest, NextResponse } from "next/server";
import { parseSneakerBoxLabelFromImageUrl } from "@/lib/parse-box-label";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { imageUrl } = await req.json();

    if (!imageUrl) {
      return NextResponse.json({ error: "Missing imageUrl." }, { status: 400 });
    }

    const parsed = await parseSneakerBoxLabelFromImageUrl(imageUrl);

    return NextResponse.json({ parsed });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to parse label image.",
      },
      { status: 500 }
    );
  }
}