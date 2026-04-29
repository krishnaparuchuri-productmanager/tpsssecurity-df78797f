import { useEnvironment } from "@/contexts/EnvironmentContext";

export default function EnvBadge() {
  const { isSandbox, loading } = useEnvironment();
  if (loading) return null;
  return (
    <div className="px-3 py-2 mt-auto border-t border-white/10 text-xs">
      {isSandbox ? (
        <span className="inline-flex items-center gap-1 text-yellow-300">🟡 SANDBOX MODE</span>
      ) : (
        <span className="inline-flex items-center gap-1 text-green-300">🟢 PRODUCTION MODE</span>
      )}
    </div>
  );
}
