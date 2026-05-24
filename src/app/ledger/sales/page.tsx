import { LedgerClient } from "@/components/LedgerClient";

export default function LedgerSalesPage() {
  return (
    <div className="min-h-full flex-1 bg-[radial-gradient(120%_80%_at_50%_-20%,rgba(16,185,129,0.12),transparent)]">
      <LedgerClient mode="sales" />
    </div>
  );
}
