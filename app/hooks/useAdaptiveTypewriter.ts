import { useEffect, useRef, useState } from "react";

/**
 * Reveals streamed text with a typewriter effect. Speed scales with backlog
 * so fast streams render quickly and slow streams stay in sync.
 */
export function useAdaptiveTypewriter(targetText: string, active: boolean) {
  const [displayText, setDisplayText] = useState("");
  const targetRef = useRef(targetText);
  const displayRef = useRef("");
  const activeRef = useRef(active);
  const rafRef = useRef<number>();

  targetRef.current = targetText;
  activeRef.current = active;

  useEffect(() => {
    if (!active && targetText === "") {
      displayRef.current = "";
      setDisplayText("");
    }
  }, [active, targetText]);

  useEffect(() => {
    if (!active) {
      displayRef.current = targetText;
      setDisplayText(targetText);
      return;
    }

    let lastTime = performance.now();

    const tick = (now: number) => {
      const target = targetRef.current;
      const current = displayRef.current;
      const pending = target.length - current.length;

      if (pending > 0) {
        const elapsed = Math.max(now - lastTime, 16);
        lastTime = now;

        const baseCharsPerSecond = 36;
        const backlogBoost = pending * 14;
        const charsPerSecond = Math.min(900, baseCharsPerSecond + backlogBoost);
        const charsToAdd = Math.max(
          1,
          Math.round((elapsed / 1000) * charsPerSecond),
        );

        const next = target.slice(
          0,
          current.length + Math.min(charsToAdd, pending),
        );
        displayRef.current = next;
        setDisplayText(next);
      } else {
        lastTime = now;
      }

      if (pending > 0 || activeRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, targetText]);

  return displayText;
}
