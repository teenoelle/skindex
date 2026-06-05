import Scanner from "@/components/Scanner";

const UUID_RE = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

type Props = { params: Promise<{ slug: string }> };

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const id = slug.match(UUID_RE)?.[1] ?? null;

  return (
    <div className="min-h-screen bg-white">
      <div className="pt-14">
        <main className="max-w-2xl mx-auto px-6 py-16">
          <Scanner initialProductId={id} />
        </main>
      </div>
    </div>
  );
}
