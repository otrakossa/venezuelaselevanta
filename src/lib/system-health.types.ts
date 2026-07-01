export type HealthMetric = {
  ok: boolean;
  value?: number;
  detail?: string;
  error?: string;
};

export type ScraperRun = {
  source: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  inserted: number | null;
  seen: number | null;
  matches: number | null;
  error: string | null;
};

export type TableStat = {
  name: string;
  rows: number;
  deadRows: number;
  sizeMB: number;
  inserts: number;
  updates: number;
  deletes: number;
  seqScans: number;
  idxScans: number;
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

  network: {
    interfaces: { name: string; rxMB: number; txMB: number }[];
  } | null;

  backup: {
    lastFile: string | null;
    lastSizeMB: number | null;
    lastModified: string | null;
  } | null;

  externalServices: {
    name: string;
    url: string;
    ok: boolean;
    statusCode: number | null;
    latencyMs: number | null;
  }[];

  database: {
    sizeMB?: number;
    sizePretty?: string;
    tables?: TableStat[];
    connections?: { total: number; active: number; idle: number; waiting: number };
    unusedIndexes?: { table: string; index: string; sizeMB: number }[];
    error?: string;
  } | null;

  appStats: {
    authUsers: number | null;
    authUsers24h: number | null;
    visitors: {
      today: number;
      yesterday: number;
      week: number;
      total: number;
      uniqueTotal: number;
    } | null;
    scraperRuns: ScraperRun[];
    error?: string;
  } | null;

  errors: string[];
};
