import { SimulatorClient } from "@/components/SimulatorClient";

export default function Home() {
  return (
    <div className="min-h-full flex-1 bg-[radial-gradient(120%_80%_at_50%_-20%,rgba(251,191,36,0.12),transparent)]">
      <SimulatorClient />
    </div>
  );
}
