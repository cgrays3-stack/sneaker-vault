import { AppHeader } from "../../components/app-header";
import { BottomNav } from "../../components/bottom-nav";
import CollectionClient from "../../components/collection-client";
import EnrichCollectionButton from "../../components/enrich-collection-button";
import RefreshMarketButton from "../../components/refresh-market-button";
import { getSneakers } from "../../lib/data";
import LogWearButton from "../../components/log-wear-button";
import { formatDateOnly } from "../../lib/format-date";

export default async function CollectionPage() {
  const sneakers = await getSneakers();

  return (
    <>
      <AppHeader />

      <section className="rounded-3xl bg-white p-5 shadow-sm text-neutral-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-neutral-900">Collection</h2>
          <p className="text-sm text-neutral-700">{sneakers.length} pairs</p>
        </div>

        <div className="mb-4 flex flex-wrap gap-3">
          <EnrichCollectionButton />
          <RefreshMarketButton />
        </div>

        <CollectionClient initialSneakers={sneakers} />
      </section>

      <BottomNav />
    </>
  );
}
