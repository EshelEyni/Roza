import express from "express";
import { checkUserAuthentication } from "../../middlewares/authGuards/authGuardsMiddleware";
import { checkReaderAccess } from "../../services/reader/readerAccessService";
import { MAX_EPUB_SIZE } from "../../services/reader/epubService";
import { AppError } from "../../services/error/errorService";
import {
  getReaderAccess,
  getReaderBooks,
  addReaderBook,
  getReaderBook,
  getReaderFile,
  updateReaderState,
} from "../../controllers/reader/readerController";

import { lookupReaderDictionary } from "../../controllers/reader/readerDictionaryController";

const router = express.Router();

router.use(checkUserAuthentication);
router.get("/access", getReaderAccess);
router.use(checkReaderAccess);
router.get("/", getReaderBooks);
const readUpload = express.raw({ type: "application/epub+zip", limit: MAX_EPUB_SIZE });
router.post(
  "/",
  (req, res, next) => {
    readUpload(req, res, (error: { status?: number } | undefined) => {
      if (error)
        return next(
          new AppError(
            error.status === 413
              ? "Upload an EPUB smaller than 25 MiB."
              : "Could not read the upload.",
            error.status === 413 ? 413 : 400,
          ),
        );
      next();
    });
  },
  addReaderBook,
);
router.post("/:id/dictionary", lookupReaderDictionary);
router.get("/:id/file", getReaderFile);
router.get("/:id", getReaderBook);
router.patch("/:id/state", updateReaderState);

export default router;
