import NavAuth from "@/components/NavAuth";
import Scanner from "@/components/Scanner";

type Props = { searchParams: Promise<{ scan?: string }> };

export default async function Home({ searchParams }: Props) {
  const { scan } = await searchParams;
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="tracking-tight select-none">
            <span className="text-xl font-black">SKIN</span>
            <span className="text-xl font-light text-gray-500">dex</span>
            <span className="font-light text-gray-300 mx-2">·</span>
            <span className="text-sm font-light text-gray-400">scan your skincare</span>
          </span>
          <NavAuth />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-6">
        <Scanner initialProductId={scan ?? null} />
      </main>
    </div>
  );
}
