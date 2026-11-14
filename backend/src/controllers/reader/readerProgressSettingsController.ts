import { Request, Response } from "express";
import { getLoggedInUserIdFromReq } from "../../services/ALSService";
import { AppError, asyncErrorCatcher } from "../../services/error/errorService";
import { ReaderProgressSettingsModel } from "../../models/reader/readerProgressSettingsModel";
import { defaultReaderProgressSettings, isReaderProgressSettings } from "../../../../shared/types/readerProgressSettings";
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
