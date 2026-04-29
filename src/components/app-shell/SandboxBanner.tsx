import { useEnvironment } from "@/contexts/EnvironmentContext";
import { AlertTriangle } from "lucide-react";

export default function SandboxBanner() {
  const { isSandbox, loading } = useEnvironment();
  if (loading || !isSandbox) return null;
  return (
    <div className="bg-yellow-100 border-b border-yellow-300 text-yellow-900 px-4 py-2 text-sm flex items-center gap-2">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        <strong>SANDBOX MODE</strong> — Test environment. Data here does not affect production records.
      </span>
    </div>
  );
}
