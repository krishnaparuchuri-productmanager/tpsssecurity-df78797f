import { useEnvironment } from "@/contexts/EnvironmentContext";

/** Returns "Save to Sandbox" / "Save" depending on env */
export function useSaveLabel(base = "Save") {
  const { isSandbox } = useEnvironment();
  return isSandbox ? `${base} to Sandbox` : base;
}
