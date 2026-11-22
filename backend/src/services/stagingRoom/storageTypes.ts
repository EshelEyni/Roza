export type DbInfo = { dbName: string; host: string };
export type Backup = (kind: "live" | "staged", snapshot: unknown) => Promise<string>;
