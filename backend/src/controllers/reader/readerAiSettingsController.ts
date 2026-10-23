import { Request, Response } from "express";
import { getLoggedInUserIdFromReq } from "../../services/ALSService";
import { asyncErrorCatcher } from "../../services/error/errorService";
import {
  getReaderAiSettings,
  saveReaderAiSettings,
} from "../../services/reader/readerAiSettingsService";

const getAiSettings = asyncErrorCatcher(async (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ status: "success", data: await getReaderAiSettings(getLoggedInUserIdFromReq()) });
});
const updateAiSettings = asyncErrorCatcher(async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    status: "success",
    data: await saveReaderAiSettings(getLoggedInUserIdFromReq(), req.body),
  });
});
export { getAiSettings, updateAiSettings };
