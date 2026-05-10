import NavAuth from "@/components/NavAuth";
import Scanner from "@/components/Scanner";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="text-xl tracking-tight select-none">
            <span className="font-black">SKIN</span>
            <span className="font-light text-gray-500">dex</span>
          </span>
          <NavAuth />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-16">
        <div className="mb-10">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 mb-2">
            Scan your skincare
          </h1>
          <p className="text-sm text-gray-400 leading-relaxed">
            Check any product for ingredients flagged by the most reactive skin on the internet.
          </p>
        </div>
        <Scanner />
      </main>
    </div>
  );
}
