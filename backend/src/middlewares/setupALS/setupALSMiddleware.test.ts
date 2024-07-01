/* eslint-disable @typescript-eslint/no-explicit-any */
import setupAsyncLocalStorage from "./setupALSMiddleware";
import { asyncLocalStorage } from "../../services/ALSService";
import tokenService from "../../services/token/tokenService";
import { Request, Response, NextFunction } from "express";

jest.mock("../../services/ALSService", () => ({
  asyncLocalStorage: {
    run: jest.fn(),
    getStore: jest.fn().mockReturnValue({}),
  },
}));

jest.mock("../../services/token/tokenService");

describe("SetupAsyncLocalStorage", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let runCallback: any;

  beforeEach(() => {
    req = {};
    res = {};
    next = jest.fn();

    // Mock the run method of asyncLocalStorage and keep track of the callback for later
    asyncLocalStorage.run = jest.fn((storage, callback, ...args) => {
      runCallback = callback(...args);
      return runCallback;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should call next immediately if there is no token", async () => {
    (tokenService.getTokenFromRequest as jest.Mock).mockReturnValue(null);

    await setupAsyncLocalStorage(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(asyncLocalStorage.run).toHaveBeenCalledTimes(1);
  });

  it("should call next immediately if the token is not valid", async () => {
    (tokenService.getTokenFromRequest as jest.Mock).mockReturnValue("token");
    (tokenService.verifyToken as jest.Mock).mockResolvedValue(null);

    await setupAsyncLocalStorage(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(asyncLocalStorage.run).toHaveBeenCalledTimes(1);
  });

  it("should set loggedInUserId in the alsStore if the token is valid", async () => {
    const verifiedToken = { id: "userId" };

    const alsStore: any = {};
    asyncLocalStorage.getStore = jest.fn().mockReturnValue(alsStore);
    asyncLocalStorage.run = jest.fn().mockImplementation((store, callback) => {
      runCallback = callback;
    });
    (tokenService.getTokenFromRequest as jest.Mock).mockReturnValue("token");
    (tokenService.verifyToken as jest.Mock).mockResolvedValue(verifiedToken);

    await setupAsyncLocalStorage(req as Request, res as Response, next);

    // Run the callback manually with the mocked alsStore
    await runCallback();

    expect(alsStore.loggedInUserId).toEqual("userId");
    expect(next).toHaveBeenCalledTimes(1);
  });
});
