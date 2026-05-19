import Link from "next/link";
import NavAuth from "@/components/NavAuth";
import Scanner from "@/components/Scanner";

const UUID_RE = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

type Props = { params: Promise<{ slug: string }> };

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const id = slug.match(UUID_RE)?.[1] ?? null;

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl tracking-tight select-none">
            <span className="font-black">SKIN</span>
            <span className="font-light text-gray-500">dex</span>
          </Link>
          <NavAuth />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-16">
        <Scanner initialProductId={id} />
      </main>
    </div>
  );
}
