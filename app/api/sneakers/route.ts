import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Basic guard (optional but recommended)
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("sneakers")
      .insert(body)
      .select("*")
      .single();

    if (error) {
      console.error("Create sneaker error:", error);

      return NextResponse.json(
        {
          success: false,
          error: error.message || "Failed to create sneaker",
        },
        { status: 500 }
      );
    }

    // Revalidate collection page so server components refetch fresh data
    revalidatePath("/collection");

    return NextResponse.json({
      success: true,
      sneaker: data,
      sneakerId: data.id, // 👈 critical for your current frontend
    });
  } catch (error) {
    console.error("Unexpected error creating sneaker:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}