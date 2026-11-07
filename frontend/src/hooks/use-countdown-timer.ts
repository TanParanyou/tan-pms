"use client";

import { useState, useEffect, useCallback } from "react";
import { formatCountdownMmSs } from "@/lib/formatters";

export interface UseCountdownTimerOptions {
  initialSeconds: number;
  onExpire?: () => void;
  autoStart?: boolean;
}

export function useCountdownTimer({
  initialSeconds,
  onExpire,
  autoStart = true,
}: UseCountdownTimerOptions) {
  const [remainingSeconds, setRemainingSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);

  useEffect(() => {
    setRemainingSeconds(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (!isRunning || remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onExpire?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, remainingSeconds, onExpire]);

  const reset = useCallback(
    (newSeconds = initialSeconds) => {
      setRemainingSeconds(newSeconds);
      setIsRunning(autoStart);
    },
    [initialSeconds, autoStart]
  );

  const pause = useCallback(() => setIsRunning(false), []);
  const resume = useCallback(() => setIsRunning(true), []);

  return {
    remainingSeconds,
    formattedTime: formatCountdownMmSs(remainingSeconds),
    isExpired: remainingSeconds <= 0,
    isRunning,
    reset,
    pause,
    resume,
  };
}
