import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const { data, error } = await supabaseAdmin
      .from("wear_logs")
      .select("id, sneaker_id, wear_date, notes, created_at")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: "Wear log not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      wearLog: data,
    });
  } catch (error) {
    console.error("get wear log error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load wear log",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const { data, error } = await supabaseAdmin
      .from("wear_logs")
      .delete()
      .eq("id", id)
      .select("id, sneaker_id, wear_date")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: "Wear log not found",
          id,
        },
        { status: 404 }
      );
    }

    revalidatePath("/wear-log");
    revalidatePath("/collection");

    return NextResponse.json({
      success: true,
      deletedWearLog: data,
    });
  } catch (error) {
    console.error("delete wear log error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete wear log",
      },
      { status: 500 }
    );
  }
}