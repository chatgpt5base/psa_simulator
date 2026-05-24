import { SimulatorClient } from "@/components/SimulatorClient";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-full flex-1 bg-[radial-gradient(120%_80%_at_50%_-20%,rgba(251,191,36,0.12),transparent)]">
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 lg:px-8">
        <Link
          href="/ledger/purchase"
          className="inline-flex rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 hover:border-emerald-300/40 hover:text-emerald-200"
        >
          支出・販売管理（ベータ版）ページへ
        </Link>
      </div>
      <SimulatorClient />
    </div>
  );
}
