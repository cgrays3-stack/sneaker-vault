import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    console.log("DELETE grail id received:", id);

    const { data, error } = await supabaseAdmin
      .from("grails")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) {
      console.error("Delete grail error:", error);

      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Grail not found",
          id,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      deletedGrail: data[0],
    });
  } catch (error) {
    console.error("Unexpected delete grail error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Delete failed",
      },
      { status: 500 }
    );
  }
}