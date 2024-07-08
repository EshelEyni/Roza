import mongoose, { Model, Query, Document } from "mongoose";
require("dotenv").config();
import { AppError } from "../error/errorService";
import { ObjectId } from "mongodb";
import {
  BookDataItem,
  Chapter,
  Character,
  Note,
  Plotline,
  Theme,
} from "../../types/books";
import { ParsedReqQuery } from "../../types/system";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObject = { [key: string]: any };

const filterObj = (obj: AnyObject, ...allowedFields: string[]): AnyObject => {
  if (allowedFields.length === 0) return obj;
  return Object.keys(obj).reduce((newObj: AnyObject, key: string) => {
    if (allowedFields.includes(key)) {
      newObj[key] = obj[key];
    }
    return newObj;
  }, {} as AnyObject);
};

class APIFeatures<T> {
  private query: Query<T[], T>;
  private queryObj: ParsedReqQuery;

  constructor(query: Query<T[], T>, queryString: ParsedReqQuery) {
    this.query = query;
    this.queryObj = queryString;
  }

  filter(): APIFeatures<T> {
    const queryObj: ParsedReqQuery = { ...this.queryObj };
    const excludedFields = ["page", "sort", "limit", "fields"];
    excludedFields.forEach((el) => delete queryObj[el]);
    const queryStr = JSON.stringify(queryObj).replace(
      /\b(gte|gt|gte|lte|lt|exists)\b/g,
      (match) => `$${match}`
    );
    this.query = this.query.find(JSON.parse(queryStr));

    return this;
  }

  sort(): APIFeatures<T> {
    if (this.queryObj.sort) {
      const sortBy = this.queryObj.sort.split(",").join(" ");
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort("-createdAt _id");
    }

    return this;
  }

  limitFields(): APIFeatures<T> {
    if (this.queryObj.fields) {
      const fields = this.queryObj.fields.split(",").join(" ");
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select("-__v");
    }

    return this;
  }

  paginate(): APIFeatures<T> {
    const page = parseInt(this.queryObj.page ?? "1", 10);
    const limit = parseInt(this.queryObj.limit ?? "100", 10);
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);

    return this;
  }

  getQuery(): Query<T[], T> {
    return this.query;
  }
}

async function queryEntityExistsById<T extends Document>(
  model: Model<T>,
  query: { _id: ObjectId }
): Promise<boolean> {
  return !!(await model.exists(query).setOptions({ skipHooks: true }).exec());
}

function isValidMongoId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}
interface IdEntity {
  id: string | undefined;
  entityName: string;
}

function validateIds(...idEntities: IdEntity[]): void {
  idEntities.forEach(({ id, entityName }) => {
    const statusCode = entityName === "loggedInUser" ? 401 : 400;
    if (!id) throw new AppError(`No ${entityName} id provided`, statusCode);
    if (!isValidMongoId(id))
      throw new AppError(`Invalid ${entityName} id: ${id}`, statusCode);
  });
}

function getUniqueStringIds(ids: ObjectId[]): string[] {
  return [...new Set(ids.map((id) => id.toString()))];
}

function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]; // Swap elements
  }
  return array;
}

function getIsraeliDate(): Date {
  const now = new Date();
  const localTime = now.getTime();
  const localOffset = now.getTimezoneOffset() * 60000; // local offset in milliseconds
  const utc = localTime + localOffset;
  const israelOffset = 3 * 60 * 60000; // Israel's UTC offset in milliseconds
  const israelTime = new Date(utc + israelOffset);
  return israelTime;
}

function isChapterType(item: BookDataItem): item is Chapter {
  return item.type === "chapters";
}

function isCharacterType(item: BookDataItem): item is Character {
  return item.type === "characters";
}

function isThemeType(item: BookDataItem): item is Theme {
  return item.type === "themes";
}

function isPlotlineType(item: BookDataItem): item is Plotline {
  return item.type === "plotlines";
}

function isNoteType(item: BookDataItem): item is Note {
  return item.type === "notes";
}

export {
  AnyObject,
  APIFeatures,
  filterObj,
  queryEntityExistsById,
  isValidMongoId,
  validateIds,
  getUniqueStringIds,
  shuffleArray,
  getIsraeliDate,
  isChapterType,
  isCharacterType,
  isThemeType,
  isPlotlineType,
  isNoteType,
};
