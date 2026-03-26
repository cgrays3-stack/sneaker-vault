import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const sneakerId =
      typeof body.sneakerId === "string" ? body.sneakerId.trim() : "";
    const wearDate =
      typeof body.wearDate === "string" ? body.wearDate.trim() : "";
    const notes =
      typeof body.notes === "string" && body.notes.trim().length > 0
        ? body.notes.trim()
        : null;

    if (!sneakerId) {
      return NextResponse.json(
        { success: false, error: "Missing sneakerId" },
        { status: 400 }
      );
    }

    if (!wearDate) {
      return NextResponse.json(
        { success: false, error: "Missing wearDate" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("wear_logs")
      .insert({
        sneaker_id: sneakerId,
        wear_date: wearDate,
        notes,
      })
      .select("id, sneaker_id, wear_date, notes, created_at")
      .single();

    if (error) {
      const message = error.message.toLowerCase();

      if (message.includes("duplicate") || message.includes("unique")) {
        return NextResponse.json(
          {
            success: false,
            error: "This shoe is already logged for that date.",
          },
          { status: 409 }
        );
      }

      throw error;
    }

    return NextResponse.json({
      success: true,
      wearLog: data,
    });
  } catch (error) {
    console.error("create wear log error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create wear log",
      },
      { status: 500 }
    );
  }
}