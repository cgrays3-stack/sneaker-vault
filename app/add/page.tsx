import AddPairForm from "@/components/add-pair-form";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";

export default function AddPage() {
  return (
    <>
      <AppHeader />

      <section className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
        <div className="text-white">
          <h1 className="text-2xl font-semibold text-white">Add Pair</h1>
          <p className="text-sm text-white/80">
            Add a new sneaker to your vault.
          </p>
        </div>

        <AddPairForm />
      </section>

      <BottomNav />
    </>
  );
}