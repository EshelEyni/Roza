import { Request, Response } from "express";
import { getLoggedInUserIdFromReq } from "../../services/ALSService";
import { AppError, asyncErrorCatcher } from "../../services/error/errorService";
import { ReaderKeyboardSettingsModel } from "../../models/reader/readerKeyboardSettingsModel";
import type { ReaderKeyboardSettings } from "../../../../shared/types/readerKeyboardSettings";
const defaultReaderKeyboardSettings: ReaderKeyboardSettings = {
  unit: "words",
  count: 1,
};
function isReaderKeyboardSettings(
  value: unknown,
): value is ReaderKeyboardSettings {
  const settings = value as ReaderKeyboardSettings | null;
  return (
    !!settings &&
    typeof settings === "object" &&
    ["words", "sentences"].includes(settings.unit) &&
    Number.isSafeInteger(settings.count) &&
    settings.count >= 1
  );
}

export const getKeyboardSettings = asyncErrorCatcher(
  async (_req: Request, res: Response) => {
    const saved = await ReaderKeyboardSettingsModel.findOne({
      userId: getLoggedInUserIdFromReq(),
    });
    res.setHeader("Cache-Control", "no-store");
    res.json({
      status: "success",
      data: saved
        ? { unit: saved.unit, count: saved.count }
        : defaultReaderKeyboardSettings,
    });
  },
);

export const updateKeyboardSettings = asyncErrorCatcher(
  async (req: Request, res: Response) => {
    if (!isReaderKeyboardSettings(req.body))
      throw new AppError(
        "Choose words or sentences and a whole-number count of at least 1.",
        400,
      );
    const settings = { unit: req.body.unit, count: req.body.count };
    await ReaderKeyboardSettingsModel.findOneAndUpdate(
      { userId: getLoggedInUserIdFromReq() },
      { $set: settings },
      { upsert: true, new: true, runValidators: true },
    );
    res.setHeader("Cache-Control", "no-store");
    res.json({ status: "success", data: settings });
  },
);
