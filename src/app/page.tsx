import SiteHeader from "@/components/SiteHeader";
import Scanner from "@/components/Scanner";
import SiteBanner from "@/components/SiteBanner";

type Props = { searchParams: Promise<{ scan?: string }> };

export default async function Home({ searchParams }: Props) {
  const { scan } = await searchParams;
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <div className="pt-14">
        <SiteBanner />
        <main className="max-w-2xl mx-auto px-6 py-6">
          <Scanner initialProductId={scan ?? null} />
        </main>
      </div>
    </div>
  );
}
