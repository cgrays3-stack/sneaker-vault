import { AppHeader } from "../../components/app-header";
import { BottomNav } from "../../components/bottom-nav";
import { supabase } from "../../lib/supabase";
import GrailsClient from "./page-client";
import { GrailCandidatePicker } from "@/components/grail-candidate-picker";
import type { Grail } from "../../lib/types";

export default async function GrailsPage() {
  const { data, error } = await supabase
    .from("grails")
    .select("*")
    .eq("status", "active")
    .order("priority", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const grails: Grail[] = error ? [] : ((data as Grail[]) ?? []);

  return (
    <>
      <AppHeader />

      <div className="space-y-4">
        <GrailCandidatePicker existingGrails={grails} />

        <section className="rounded-3xl bg-white p-5 shadow-sm text-neutral-900">
          <div className="mb-4">
            <h2 className="text-2xl font-semibold">Grail Wishlist</h2>
            <p className="text-sm text-slate-500">
              Track the pairs you want and compare used vs new market prices.
            </p>
          </div>

          <GrailsClient initialGrails={grails} />
        </section>
      </div>

      <BottomNav />
    </>
  );
}