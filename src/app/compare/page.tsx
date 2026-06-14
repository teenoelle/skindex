import ComparePageClient from "./ComparePage";

type Props = { searchParams: Promise<{ ids?: string }> };

export default async function ComparePage({ searchParams }: Props) {
  const { ids } = await searchParams;
  return <ComparePageClient ids={ids ?? ""} />;
}
