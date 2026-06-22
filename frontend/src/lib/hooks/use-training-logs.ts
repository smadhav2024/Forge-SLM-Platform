"use client";

import { useEffect, useState } from "react";

export function useTrainingLogs(modelId: number | null, isTraining: boolean) {
  const [logs, setLogs] = useState<string[]>([]);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (!modelId || !isTraining) return;

    setLogs([]);
    setIsDone(false);

    const es = new EventSource(`/api/models/${modelId}/logs/stream`);

    es.onmessage = (e) => {
      const line: string = e.data;
      setLogs((prev) => [...prev, line]);

      if (line.includes("Training successfully completed!")) {
        setIsDone(true);
        es.close();
      }
    };

    es.onerror = () => {
      setIsDone(true);
      es.close();
    };

    return () => es.close();
  }, [modelId, isTraining]);

  return { logs, isDone };
}