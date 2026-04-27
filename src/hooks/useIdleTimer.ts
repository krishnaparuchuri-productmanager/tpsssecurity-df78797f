import { useEffect, useRef, useState } from "react";

interface Options {
  timeoutMs: number;
  warningMs: number;
  onWarn: () => void;
  onTimeout: () => void;
  enabled: boolean;
}

export function useIdleTimer({ timeoutMs, warningMs, onWarn, onTimeout, enabled }: Options) {
  const lastActivity = useRef<number>(Date.now());
  const warnedRef = useRef<boolean>(false);
  const [remainingMs, setRemainingMs] = useState(timeoutMs);

  useEffect(() => {
    if (!enabled) return;

    const reset = () => {
      lastActivity.current = Date.now();
      warnedRef.current = false;
    };

    const events: Array<keyof WindowEventMap> = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));

    const interval = window.setInterval(() => {
      const elapsed = Date.now() - lastActivity.current;
      const remaining = timeoutMs - elapsed;
      setRemainingMs(Math.max(0, remaining));

      if (remaining <= 0) {
        onTimeout();
        return;
      }
      if (!warnedRef.current && remaining <= timeoutMs - warningMs) {
        warnedRef.current = true;
        onWarn();
      }
    }, 1000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      window.clearInterval(interval);
    };
  }, [enabled, timeoutMs, warningMs, onWarn, onTimeout]);

  return { remainingMs };
}
