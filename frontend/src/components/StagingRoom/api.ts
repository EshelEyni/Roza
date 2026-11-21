import type { StagingRoomApi } from "../../../../shared/types/stagingRoom";

export const api = window.rozaDesktop?.stagingRoom as StagingRoomApi;

export const errorText = (error: unknown) =>
  String((error as Error)?.message || error).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
