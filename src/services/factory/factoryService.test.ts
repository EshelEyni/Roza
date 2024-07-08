/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction } from "express";
import { createOne, deleteOne, getAll, getOne, updateOne } from "./factoryService";
import { asyncErrorCatcher } from "../error/errorService";
import { logger } from "../logger/loggerService";
import { getMongoId } from "../test/testUtilService";

const APIFeaturesMock = {
  filter: jest.fn(),
  sort: jest.fn(),
  limitFields: jest.fn(),
  paginate: jest.fn(),
  getQuery: jest.fn(),
};

const nextMock = jest.fn() as jest.MockedFunction<NextFunction>;

jest.mock("../util/utilService", () => ({
  APIFeatures: jest.fn().mockImplementation(() => APIFeaturesMock),
  validateIds: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
(asyncErrorCatcher as jest.Mock) = jest.fn().mockImplementation(fn => {
  return async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      return nextMock(error);
    }
  };
});

describe("Factory Service", () => {
  const resMock = {
    status: jest.fn(),
    json: jest.fn(),
  } as any;
  const reqMock = {
    query: {},
    params: {},
    body: {},
  } as any;

  function setMocks() {
    APIFeaturesMock.filter.mockReturnThis();
    APIFeaturesMock.sort.mockReturnThis();
    APIFeaturesMock.limitFields.mockReturnThis();
    APIFeaturesMock.paginate.mockReturnThis();
    APIFeaturesMock.getQuery.mockReturnValue(Promise.resolve([]) as any);
    reqMock.query = {};
    resMock.status.mockReturnValue(resMock);
    resMock.json.mockReturnThis();
  }

  describe("getAll", () => {
    const ModelMock = {
      find: jest.fn(),
      collection: { collectionName: "testItems" },
    } as any;

    beforeEach(() => {
      setMocks();
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should call getQuery method", async () => {
      const controller = getAll(ModelMock) as any;
      expect(controller).toBeDefined();
      await controller(reqMock, resMock, nextMock);
      expect(APIFeaturesMock.getQuery).toHaveBeenCalled();
    });

    it("should return success status", async () => {
      const controller = getAll(ModelMock) as any;
      await controller(reqMock, resMock, nextMock);
      expect(resMock.json).toHaveBeenCalledWith(expect.objectContaining({ status: "success" }));
    });

    it("should return requestedAt in response", async () => {
      const controller = getAll(ModelMock) as any;
      await controller(reqMock, resMock, nextMock);
      expect(resMock.json).toHaveBeenCalledWith(
        expect.objectContaining({ requestedAt: expect.any(String) }),
      );
    });

    it("should return a valid timestamp in requestedAt", async () => {
      const controller = getAll(ModelMock) as any;
      await controller(reqMock, resMock, nextMock);
      expect(resMock.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requestedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
        }),
      );
    });

    it("should integrate getAll and APIFeatures correctly", async () => {
      const mockData = [1, 2, 3];
      APIFeaturesMock.getQuery.mockReturnValue(Promise.resolve(mockData) as any);
      const controller = getAll(ModelMock) as any;
      reqMock.query = { page: "1", sort: "name", limit: "10", fields: "name" };
      await controller(reqMock, resMock, nextMock);

      expect(APIFeaturesMock.filter).toHaveBeenCalledWith();
      expect(APIFeaturesMock.sort).toHaveBeenCalled();
      expect(APIFeaturesMock.limitFields).toHaveBeenCalled();
      expect(APIFeaturesMock.paginate).toHaveBeenCalled();

      expect(resMock.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "success",
          results: mockData.length,
          data: mockData,
        }),
      );
    });

    it("should pass the error to next if getQuery fails", async () => {
      const mockError = new Error("getQuery failed");
      APIFeaturesMock.getQuery.mockImplementation(() => {
        throw mockError;
      });
      const controller = getAll(ModelMock) as any;
      await controller(reqMock, resMock, nextMock);
      expect(nextMock).toHaveBeenCalledWith(mockError);
    });
  });

  describe("getOne", () => {
    let id: string, mockData: any, error: Error, queryMock: any;

    const ModelMock = {
      findById: jest.fn(),
      collection: { collectionName: "testItems" },
    } as any;

    beforeEach(() => {
      setMocks();
      id = getMongoId();
      reqMock.params.id = id;
      mockData = { _id: id, name: "Item" };
      error = new Error("Test error");
      queryMock = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockData),
      };

      ModelMock.findById.mockReturnValue(queryMock as any);
      ModelMock.collection.collectionName = "testItems";
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should return the correct document when a valid id is given", async () => {
      const controller = getOne(ModelMock) as any;
      await controller(reqMock, resMock, nextMock);
      expect(ModelMock.findById).toHaveBeenCalledWith(id);
      expect(resMock.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "success",
          data: mockData,
        }),
      );
    });

    it("should return status 404 when the document is not found", async () => {
      queryMock.exec.mockReturnValue(Promise.resolve(null) as any);
      const controller = getOne(ModelMock) as any;
      await controller(reqMock, resMock, nextMock);
      expect(ModelMock.findById).toHaveBeenCalledWith(id);
      expect(nextMock).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: expect.any(String),
        }),
      );
    });

    it("should populate the document if popOptions are given", async () => {
      const popOptions = "user";
      const controller = getOne(ModelMock, popOptions) as any;
      await controller(reqMock, resMock, nextMock);
      expect(ModelMock.findById).toHaveBeenCalledWith(id);
      expect(queryMock.populate).toHaveBeenCalledWith(popOptions);
      expect(resMock.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "success",
          data: mockData,
        }),
      );
    });

    it("should pass error to next when findById throws an error", async () => {
      ModelMock.findById.mockImplementation(() => {
        throw error;
      });
      const controller = getOne(ModelMock) as any;
      await controller(reqMock, resMock, nextMock);
      expect(ModelMock.findById).toHaveBeenCalledWith(id);
      expect(nextMock).toHaveBeenCalledWith(error);
    });

    it("should pass error to next when populate throws an error", async () => {
      const popOptions = "user";
      queryMock.populate = jest.fn().mockImplementation(() => {
        throw error;
      });

      const controller = getOne(ModelMock, popOptions) as any;
      await controller(reqMock, resMock, nextMock);
      expect(ModelMock.findById).toHaveBeenCalledWith(id);
      expect(queryMock.populate).toHaveBeenCalledWith(popOptions);
      expect(nextMock).toHaveBeenCalledWith(error);
    });
  });

  describe("createOne", () => {
    const ModelMock = {
      create: jest.fn(),
      collection: { collectionName: "testItems" },
    } as any;

    beforeEach(() => {
      setMocks();
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should create a new document when valid data is provided", async () => {
      reqMock.body = { name: "Test" };
      const mockData = { _id: "1234567890", name: "Test" };
      ModelMock.create.mockReturnValue(Promise.resolve(mockData) as any);
      const controller = createOne(ModelMock) as any;
      await controller(reqMock, resMock, nextMock);

      expect(ModelMock.create).toHaveBeenCalledWith(reqMock.body);
      expect(resMock.status).toHaveBeenCalledWith(201);
      expect(resMock.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "success",
          data: mockData,
        }),
      );
    });

    it("should pass error to next when Model.create throws an error", async () => {
      reqMock.body = { name: "Test" };
      const error = new Error("Test error");
      ModelMock.create.mockImplementation(() => {
        throw error;
      });
      const controller = createOne(ModelMock) as any;
      await controller(reqMock, resMock, nextMock);

      expect(ModelMock.create).toHaveBeenCalledWith(reqMock.body);
      expect(nextMock).toHaveBeenCalledWith(error);
    });
  });

  describe("updateOne", () => {
    const ModelMock = {
      findByIdAndUpdate: jest.fn(),
      collection: { collectionName: "testItems" },
    } as any;

    beforeEach(() => {
      setMocks();
      reqMock.params.id = "1234567890";
      reqMock.body = { name: "Updated Item" };
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should update the document when a valid id and body are given", async () => {
      const mockData = { _id: reqMock.params.id, name: reqMock.body.name };
      ModelMock.findByIdAndUpdate.mockReturnValue(Promise.resolve(mockData));
      const controller = updateOne(ModelMock) as any;
      await controller(reqMock, resMock, nextMock);

      expect(ModelMock.findByIdAndUpdate).toHaveBeenCalledWith(reqMock.params.id, reqMock.body, {
        new: true,
        runValidators: true,
      });
      expect(resMock.json).toHaveBeenCalledWith({ status: "success", data: mockData });
    });

    it("should return status 404 when the document is not found", async () => {
      ModelMock.findByIdAndUpdate.mockReturnValue(Promise.resolve(null));

      const controller = updateOne(ModelMock) as any;
      await controller(reqMock, resMock, nextMock);

      expect(ModelMock.findByIdAndUpdate).toHaveBeenCalledWith(reqMock.params.id, reqMock.body, {
        new: true,
        runValidators: true,
      });
      expect(nextMock).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: expect.any(String),
        }),
      );
    });

    it("should only update allowed fields if they are provided", async () => {
      const mockData = { _id: reqMock.params.id, name: reqMock.body.name };
      const extraField = "extraField";
      reqMock.body[extraField] = "extraValue";
      ModelMock.findByIdAndUpdate.mockReturnValue(Promise.resolve(mockData));

      const allowedFields = ["name"];
      const controller = updateOne(ModelMock, allowedFields) as any;

      await controller(reqMock, resMock, nextMock);

      expect(ModelMock.findByIdAndUpdate).toHaveBeenCalledWith(
        reqMock.params.id,
        expect.not.objectContaining({
          [extraField]: expect.anything(),
        }),
        {
          new: true,
          runValidators: true,
        },
      );
    });

    it("should pass error to next function when Model.findByIdAndUpdate throws an error", async () => {
      const errorMessage = "Test error";
      ModelMock.findByIdAndUpdate.mockReturnValue(Promise.reject(new Error(errorMessage)));

      const controller = updateOne(ModelMock) as any;

      await controller(reqMock, resMock, nextMock);

      expect(nextMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: errorMessage,
        }),
      );
    });
  });

  describe("deleteOne", () => {
    let mockData: any;

    const ModelMock = {
      findByIdAndDelete: jest.fn(),
      collection: { collectionName: "testItems" },
    } as any;

    beforeEach(() => {
      setMocks();
      mockData = { _id: reqMock.params.id };
      reqMock.params.id = "1234567890";
      ModelMock.collection.collectionName = "testItems";
      jest.spyOn(logger, "warn").mockImplementation(() => {
        return;
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should delete the document when a valid id is given", async () => {
      ModelMock.findByIdAndDelete.mockReturnValue(Promise.resolve(mockData) as any);
      const controller = deleteOne(ModelMock) as any;
      await controller(reqMock, resMock, nextMock);
      expect(ModelMock.findByIdAndDelete).toHaveBeenCalledWith(reqMock.params.id);
      expect(resMock.status).toHaveBeenCalledWith(204);
      expect(resMock.json).toHaveBeenCalledWith({ status: "success", data: null });
    });

    it("should call logger.warn when a document is deleted", async () => {
      ModelMock.findByIdAndDelete.mockReturnValue(Promise.resolve(mockData) as any);
      const controller = deleteOne(ModelMock) as any;
      await controller(reqMock, resMock, nextMock);
      const expectedMessage = `Deleted testItem with id: ${reqMock.params.id}`;
      expect(logger.warn).toHaveBeenCalledWith(expectedMessage);
    });

    it("should not call logger.warn when a document is not deleted", async () => {
      ModelMock.findByIdAndDelete.mockReturnValue(Promise.resolve(null) as any);
      const controller = deleteOne(ModelMock) as any;
      await controller(reqMock, resMock, nextMock);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("should return status 404 when the document is not found", async () => {
      ModelMock.findByIdAndDelete.mockReturnValue(Promise.resolve(null) as any);
      const controller = deleteOne(ModelMock) as any;
      await controller(reqMock, resMock, nextMock);
      expect(nextMock).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: expect.any(String),
        }),
      );
    });

    it("should pass error to next function when Model.findByIdAndDelete throws an error", async () => {
      const errorMessage = "Test error";
      ModelMock.findByIdAndDelete.mockReturnValue(Promise.reject(new Error(errorMessage)) as any);
      const controller = deleteOne(ModelMock) as any;
      await controller(reqMock, resMock, nextMock);
      expect(nextMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.any(String),
        }),
      );
    });
  });
});
