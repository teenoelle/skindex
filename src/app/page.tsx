import Scanner from "@/components/Scanner";
import SiteBanner from "@/components/SiteBanner";

type Props = { searchParams: Promise<{ scan?: string; camera?: string }> };

export default async function Home({ searchParams }: Props) {
  const { scan, camera } = await searchParams;
  return (
    <div className="min-h-screen bg-white">
      <div className="pt-14">
        <SiteBanner />
        <main className="max-w-2xl mx-auto px-6 py-6">
          <Scanner initialProductId={scan ?? null} initialCamera={camera ?? null} />
        </main>
      </div>
    </div>
  );
}
