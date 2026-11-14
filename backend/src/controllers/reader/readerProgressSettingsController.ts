import { Request, Response } from "express";
import { getLoggedInUserIdFromReq } from "../../services/ALSService";
import { AppError, asyncErrorCatcher } from "../../services/error/errorService";
import { ReaderProgressSettingsModel } from "../../models/reader/readerProgressSettingsModel";
import type { ReaderProgressSettings } from "../../../../shared/types/readerProgressSettings";

// Keep runtime values in the backend: shared source files are in an ESM package.
const defaultReaderProgressSettings: ReaderProgressSettings = {
  defaultProgressDisplay: "percentage",
};
function isReaderProgressSettings(value: unknown): value is ReaderProgressSettings {
  const settings = value as ReaderProgressSettings | null;
  return !!settings && typeof settings === "object" &&
    ["percentage", "section", "book"].includes(settings.defaultProgressDisplay);
}

export const getProgressSettings = asyncErrorCatcher(
  async (_req: Request, res: Response) => {
    const saved = await ReaderProgressSettingsModel.findOne({
      userId: getLoggedInUserIdFromReq(),
    });
    res.setHeader("Cache-Control", "no-store");
    res.json({
      status: "success",
      data: saved
        ? { defaultProgressDisplay: saved.defaultProgressDisplay }
        : defaultReaderProgressSettings,
    });
  },
);

export const updateProgressSettings = asyncErrorCatcher(
  async (req: Request, res: Response) => {
    if (!isReaderProgressSettings(req.body))
      throw new AppError(
        "Choose percentage, section, or book progress.",
        400,
      );
    const settings = { defaultProgressDisplay: req.body.defaultProgressDisplay };
    await ReaderProgressSettingsModel.findOneAndUpdate(
      { userId: getLoggedInUserIdFromReq() },
      { $set: settings },
      { upsert: true, new: true, runValidators: true },
    );
    res.setHeader("Cache-Control", "no-store");
    res.json({ status: "success", data: settings });
  },
);
