export type HealthMetric = {
  ok: boolean;
  value?: number;
  detail?: string;
  error?: string;
};

export type SystemHealth = {
  timestamp: string;
  node: {
    version: string;
    uptimeSec: number;
    pid: number;
  };
  memory: {
    process: { rssMB: number; heapUsedMB: number; heapTotalMB: number; externalMB: number };
    os: { totalMB: number; freeMB: number; usedMB: number; usedPct: number } | null;
  };
  cpu: {
    cores: number | null;
    loadavg: [number, number, number] | null;
    loadPctPerCore: number | null;
  };
  disk: {
    path: string;
    totalGB: number;
    freeGB: number;
    usedGB: number;
    usedPct: number;
  } | null;
  database: {
    sizeMB?: number;
    sizePretty?: string;
    tables?: { name: string; rows: number; sizeMB: number }[];
    error?: string;
  } | null;
  errors: string[];
};