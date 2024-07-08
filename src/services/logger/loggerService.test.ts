/* eslint-disable no-console */
import fs from "fs";
import { logger } from "./loggerService";

jest.mock("fs", () => ({
  appendFile: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
}));

jest.spyOn(console, "log").mockImplementation(() => {
  return;
});

describe("Logger Service", () => {
  beforeAll(() => {
    process.env.NODE_ENV = "test_log";
  });

  afterAll(() => {
    process.env.NODE_ENV = "test";
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should log any type of value in debug method correctly", () => {
    const message = "Test debug message";
    logger.debug(message);
    const fileLogArg = (fs.appendFile as unknown as jest.Mock).mock.calls[0][1];
    const consoleLogArg = (console.log as jest.Mock).mock.calls[0][0];
    expect(console.log).toHaveBeenCalledWith(consoleLogArg);
    expect(fs.appendFile).toHaveBeenCalledWith(
      "./logs/backend.log",
      fileLogArg,
      expect.any(Function)
    );

    const obj = { a: 1, b: 2 };
    logger.debug(message, obj);
    const fileLogArg_2 = (fs.appendFile as unknown as jest.Mock).mock.calls[1][1];
    const consoleLogArg_2 = (console.log as jest.Mock).mock.calls[1][0];
    expect(console.log).toHaveBeenCalledWith(consoleLogArg_2);
    expect(fs.appendFile).toHaveBeenCalledWith(
      "./logs/backend.log",
      fileLogArg_2,
      expect.any(Function)
    );

    const err = new Error("Test error");
    logger.debug(message, err);
    const fileLogArg_3 = (fs.appendFile as unknown as jest.Mock).mock.calls[2][1];
    const consoleLogArg_3 = (console.log as jest.Mock).mock.calls[2][0];
    expect(console.log).toHaveBeenCalledWith(consoleLogArg_3);
    expect(fs.appendFile).toHaveBeenCalledWith(
      "./logs/backend.log",
      fileLogArg_3,
      expect.any(Function)
    );
  });

  it("should log info messages", () => {
    const message = "Test info message";
    logger.info(message);
    const fileLogArg = (fs.appendFile as unknown as jest.Mock).mock.calls[0][1];
    const consoleLogArg = (console.log as jest.Mock).mock.calls[0][0];
    expect(console.log).toHaveBeenCalledWith(consoleLogArg);
    expect(fs.appendFile).toHaveBeenCalledWith(
      "./logs/backend.log",
      fileLogArg,
      expect.any(Function)
    );
  });

  it("should log success messages", () => {
    const message = "Test success message";
    logger.success(message);
    const fileLogArg = (fs.appendFile as unknown as jest.Mock).mock.calls[0][1];
    const consoleLogArg = (console.log as jest.Mock).mock.calls[0][0];
    expect(console.log).toHaveBeenCalledWith(consoleLogArg);
    expect(fs.appendFile).toHaveBeenCalledWith(
      "./logs/backend.log",
      fileLogArg,
      expect.any(Function)
    );
  });

  it("should log warn messages", () => {
    const message = "Test warn message";
    logger.warn(message);
    const fileLogArg = (fs.appendFile as unknown as jest.Mock).mock.calls[0][1];
    const consoleLogArg = (console.log as jest.Mock).mock.calls[0][0];
    expect(console.log).toHaveBeenCalledWith(consoleLogArg);
    expect(fs.appendFile).toHaveBeenCalledWith(
      "./logs/backend.log",
      fileLogArg,
      expect.any(Function)
    );
  });

  it("should log error messages", () => {
    const message = "Test error message";
    logger.error(message);
    const fileLogArg = (fs.appendFile as unknown as jest.Mock).mock.calls[0][1];
    const consoleLogArg = (console.log as jest.Mock).mock.calls[0][0];
    expect(console.log).toHaveBeenCalledWith(consoleLogArg);
    expect(fs.appendFile).toHaveBeenCalledWith(
      "./logs/backend.log",
      fileLogArg,
      expect.any(Function)
    );

    const err = new Error("Test error");
    logger.error(message, err);
    const fileLogArg_2 = (fs.appendFile as unknown as jest.Mock).mock.calls[1][1];
    const consoleLogArg_2 = (console.log as jest.Mock).mock.calls[1][0];
    expect(console.log).toHaveBeenCalledWith(consoleLogArg_2);
    expect(fs.appendFile).toHaveBeenCalledWith(
      "./logs/backend.log",
      fileLogArg_2,
      expect.any(Function)
    );
  });
});
