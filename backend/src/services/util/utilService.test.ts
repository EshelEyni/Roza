/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose, { Query } from "mongoose";
import { ObjectId } from "mongodb";
import {
  APIFeatures,
  AnyObject,
  filterObj,
  queryEntityExistsById,
  isValidMongoId,
  validateIds,
  getUniqueStringIds,
} from "./utilService";
import { AppError } from "../error/errorService";
import { getMongoId } from "../test/testUtilService";
import { ParsedReqQuery } from "../../types/app";
require("dotenv").config();

describe("Util Service", () => {
  describe("filterObj", () => {
    let testObj: AnyObject;

    beforeEach(() => {
      testObj = {
        a: 1,
        b: 2,
        c: 3,
        d: 4,
      };
    });

    it("should return the object as is if no fields are specified", () => {
      const result = filterObj(testObj);
      expect(result).toEqual(testObj);
    });

    it("should return an object with only the specified fields", () => {
      const result = filterObj(testObj, "a", "c");
      const expectedResult = { a: 1, c: 3 };
      expect(result).toEqual(expectedResult);
    });

    it("should return an empty object if none of the fields are allowed", () => {
      const result = filterObj(testObj, "e", "f");
      const expectedResult = {};
      expect(result).toEqual(expectedResult);
    });
  });

  describe("APIFeatures", () => {
    let apiFeatures: APIFeatures<any>;
    let mockQuery: Query<any[], any>;
    let mockQueryObj: ParsedReqQuery;

    function setMocks() {
      mockQuery = {
        find: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
      } as unknown as Query<any[], any>;

      mockQueryObj = {
        page: "1",
        sort: "field",
        limit: "10",
        fields: "field1,field2",
        gte: "10",
      };

      apiFeatures = new APIFeatures(mockQuery, mockQueryObj);
    }

    describe("constructor", () => {
      beforeEach(setMocks);

      it("should create an instance of APIFeatures", () => {
        expect(apiFeatures).toBeInstanceOf(APIFeatures);
      });
    });

    describe("filter", () => {
      beforeEach(setMocks);

      it("should filter query based on queryString and return updated APIFeatures instance", () => {
        const apiFeaturesFiltered = apiFeatures.filter();

        expect(mockQuery.find).toHaveBeenCalled();
        expect(apiFeaturesFiltered).toBeInstanceOf(APIFeatures);
      });

      it("should correctly parse the query string and call find with the parsed query", () => {
        const expectedQueryObj: ParsedReqQuery = { ...mockQueryObj };
        const excludedFields = ["page", "sort", "limit", "fields"];
        excludedFields.forEach(el => delete expectedQueryObj[el]);
        const expectedQueryStr = JSON.stringify(expectedQueryObj).replace(
          /\b(gte|gt|lte|lt|exists)\b/g,
          match => `$${match}`,
        );

        apiFeatures.filter();
        expect(mockQuery.find).toHaveBeenCalledWith(JSON.parse(expectedQueryStr));
      });
    });

    describe("sort", () => {
      beforeEach(setMocks);

      it("should sort query based on queryString and return updated APIFeatures instance", () => {
        const apiFeaturesSorted = apiFeatures.sort();

        expect(mockQuery.sort).toHaveBeenCalled();
        expect(apiFeaturesSorted).toBeInstanceOf(APIFeatures);
      });

      it("should sort query by createdAt and _id if no sort is specified", () => {
        delete mockQueryObj.sort;
        apiFeatures.sort();
        expect(mockQuery.sort).toHaveBeenCalledWith("-createdAt _id");
      });

      it("should sort query by the specified field", () => {
        const expectedSortBy = mockQueryObj.sort;
        apiFeatures.sort();
        expect(mockQuery.sort).toHaveBeenCalledWith(expectedSortBy);
      });
    });

    describe("limitFields", () => {
      beforeEach(setMocks);

      it("should limit fields based on queryString and return updated APIFeatures instance", () => {
        const apiFeaturesLimited = apiFeatures.limitFields();

        expect(mockQuery.select).toHaveBeenCalled();
        expect(apiFeaturesLimited).toBeInstanceOf(APIFeatures);
      });

      it("should limit fields by the specified fields", () => {
        const expectedFields = mockQueryObj.fields!.split(",").join(" ");
        apiFeatures.limitFields();
        expect(mockQuery.select).toHaveBeenCalledWith(expectedFields);
      });

      it("should limit fields by default if no fields are specified", () => {
        delete mockQueryObj.fields;
        apiFeatures.limitFields();
        expect(mockQuery.select).toHaveBeenCalledWith("-__v");
      });
    });

    describe("paginate", () => {
      beforeEach(setMocks);

      it("should paginate based on queryString and return updated APIFeatures instance", () => {
        const apiFeaturesPaginated = apiFeatures.paginate();

        expect(mockQuery.skip).toHaveBeenCalled();
        expect(mockQuery.limit).toHaveBeenCalled();
        expect(apiFeaturesPaginated).toBeInstanceOf(APIFeatures);
      });

      it("should paginate by the specified page and limit", () => {
        const expectedPage = parseInt(mockQueryObj.page!);
        const expectedLimit = parseInt(mockQueryObj.limit!);
        const expectedSkip = (expectedPage - 1) * expectedLimit;

        apiFeatures.paginate();
        expect(mockQuery.skip).toHaveBeenCalledWith(expectedSkip);
        expect(mockQuery.limit).toHaveBeenCalledWith(expectedLimit);
      });

      it("should paginate by default if no page and limit are specified", () => {
        delete mockQueryObj.page;
        delete mockQueryObj.limit;
        const defaultPage = 1;
        const defaultLimit = 100;
        const expectedSkip = (defaultPage - 1) * defaultLimit;

        apiFeatures.paginate();
        expect(mockQuery.skip).toHaveBeenCalledWith(expectedSkip);
        expect(mockQuery.limit).toHaveBeenCalledWith(defaultLimit);
      });
    });

    describe("getQuery", () => {
      beforeEach(setMocks);

      it("should return the query", () => {
        const result = apiFeatures.getQuery();
        expect(result).toEqual(mockQuery);
      });
    });
  });

  describe("queryEntityExistsById", () => {
    const mockModel: any = { exists: jest.fn() };

    function setMockModel(value: any) {
      mockModel.exists = jest.fn().mockImplementation(() => {
        return {
          setOptions: jest.fn().mockImplementation((options: any) => {
            expect(options).toEqual({ skipHooks: true });
            return {
              exec: jest.fn().mockResolvedValue(value),
            };
          }),
        };
      });
    }

    it("should return true if entity exists", async () => {
      const _id = new mongoose.Types.ObjectId();
      setMockModel(true);
      const result = await queryEntityExistsById(mockModel, { _id });

      expect(result).toBe(true);
      expect(mockModel.exists).toHaveBeenCalledWith({ _id });
    });

    it("should return false if entity does not exist", async () => {
      const _id = new mongoose.Types.ObjectId();
      setMockModel(false);
      const result = await queryEntityExistsById(mockModel, { _id });

      expect(result).toBe(false);
      expect(result).toBe(false);
      expect(mockModel.exists).toHaveBeenCalledWith({ _id });
    });
  });

  describe("isValidMongoId", () => {
    const invalidIds = [
      { id: "Questions/0000000000000003599-A", type: "RavenDB Id" },
      { id: "550e8400-e29b-41d4-a716-446655440000", type: "UUID" },
      { id: "1234567890", type: "Numeric Id" },
      { id: "abcd1234", type: "Alphanumeric Id" },
      { id: "Zm9vYmFy", type: "Base64 Id" },
      { id: "foo-bar", type: "Slug Id" },
      { id: "123e4567-e89b-12d3-a456-426614174000", type: "GUID" },
      { id: "1DVZDJJY", type: "Short Id" },
      { id: "123-456-789", type: "Hyphenated Id" },
    ];

    it("should return true if id is valid", () => {
      const result = isValidMongoId("5e9d2d7f3c9d440000a1d3b0");
      expect(result).toBe(true);
    });

    it("should return false if id is invalid", () => {
      const result = isValidMongoId("invalidId");
      expect(result).toBe(false);
    });

    it("should return false if id is empty", () => {
      const result = isValidMongoId("");
      expect(result).toBe(false);
    });

    it.each(invalidIds)("should return false if id is of type: $type", invalidId => {
      const result = isValidMongoId(invalidId.id);
      expect(result).toBe(false);
    });
  });

  describe("validateIds", () => {
    const validMongoId = getMongoId();

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should throw an error if no ID is provided for an entity with a status of 400", () => {
      expect(() => validateIds({ id: undefined, entityName: "post" })).toThrow(
        new AppError("No post id provided", 400),
      );
    });

    it("should throw an error if no ID is provided for loggedInUser with a status of 401", () => {
      expect(() => validateIds({ id: undefined, entityName: "loggedInUser" })).toThrow(
        new AppError("No loggedInUser id provided", 401),
      );
    });

    it("should throw an error if an invalid Mongo ID is provided for an entity with a status of 400", () => {
      expect(() => validateIds({ id: "invalidPostId", entityName: "post" })).toThrow(
        new AppError("Invalid post id: invalidPostId", 400),
      );
    });

    it("should throw an error if an invalid Mongo ID is provided for loggedInUser with a status of 401", () => {
      expect(() => validateIds({ id: "invalidUserId", entityName: "loggedInUser" })).toThrow(
        new AppError("Invalid loggedInUser id: invalidUserId", 401),
      );
    });

    it("should not throw any error if a valid Mongo ID is provided for an entity", () => {
      expect(() => validateIds({ id: validMongoId, entityName: "post" })).not.toThrow();

      expect(() => validateIds({ id: validMongoId, entityName: "loggedInUser" })).not.toThrow();
    });

    it("should validate multiple ID entities at once", () => {
      expect(() =>
        validateIds(
          { id: validMongoId, entityName: "post" },
          { id: "invalidUserId", entityName: "loggedInUser" },
        ),
      ).toThrow(new AppError("Invalid loggedInUser id: invalidUserId", 401));

      expect(() =>
        validateIds(
          { id: "invalidPostId", entityName: "post" },
          { id: validMongoId, entityName: "loggedInUser" },
        ),
      ).toThrow(new AppError("Invalid post id: invalidPostId", 400));
    });
  });

  describe("getUniqueStringIds", () => {
    const getMongoId = () => new ObjectId();
    const ids = Array(10).fill(null).map(getMongoId);

    it("should return an array of unique string ids", () => {
      const result = getUniqueStringIds([...ids, ...ids]);
      expect(result).toHaveLength(ids.length);
      expect(result).toEqual(ids.map(id => id.toString()));
    });
  });
});
