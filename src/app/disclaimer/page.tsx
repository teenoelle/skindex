import Link from "next/link";
import NavAuth from "@/components/NavAuth";

export const metadata = {
  title: "Disclaimer — SKINdex",
};

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="tracking-tight select-none">
            <span className="text-xl font-black">SKIN</span>
            <span className="text-xl font-light text-gray-500">dex</span>
            <span className="font-light text-gray-300 mx-2">·</span>
            <span className="text-sm font-light text-gray-400">Scan your skincare</span>
          </Link>
          <NavAuth />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <h1 className="text-lg font-semibold text-gray-900">Disclaimer</h1>

        <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
          <p>
            SKINdex helps you understand what&apos;s in your skincare products, but it isn&apos;t a substitute for professional medical advice. Ingredient sensitivities vary from person to person — a flagged ingredient may not affect you, and an unflagged one might.
          </p>
          <p>
            If you have a skin condition, known allergies, or reactive skin, we recommend speaking with a dermatologist before changing your routine.
          </p>
          <p>
            The information on this site has not been evaluated by the FDA and is not intended to diagnose, treat, or prevent any condition.
          </p>
        </div>

        <Link href="/" className="inline-block text-sm text-gray-400 underline underline-offset-2 hover:text-gray-700">
          Back to SKINdex
        </Link>
      </main>
    </div>
  );
}
