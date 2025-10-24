import { useEffect, useRef } from "react";
import { setTooltip } from "obsidian";

export function useObsidianTooltip<T extends HTMLElement>(tooltipText: string, deps: unknown[] = []) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (ref.current) {
      setTooltip(ref.current, tooltipText);
    }
  }, [tooltipText]);

  return ref;
}