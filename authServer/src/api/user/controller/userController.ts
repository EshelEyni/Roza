import { Request, Response } from "express";
import userService from "../service/userService";
import { UserModel } from "../../../models/user/userModel";
import {
  AppError,
  asyncErrorCatcher,
  createOne,
  deleteOne,
  getAll,
  getLoggedInUserIdFromReq,
  getOne,
  updateOne,
  validatePatchRequestBody,
} from "@rozaeyni/common";

const getUsers = getAll(UserModel);

const getUserById = getOne(UserModel);
const addUser = createOne(UserModel);
const updateUser = updateOne(UserModel, ["username", "email", "fullname", "imgUrl", "email"]);

const removeUser = deleteOne(UserModel);

const getUserByUsername = asyncErrorCatcher(async (req: Request, res: Response): Promise<void> => {
  const { username } = req.params;
  if (!username) throw new AppError("No user username provided", 400);
  const user = await userService.getByUsername(username);

  res.send({
    status: "success",
    requestedAt: new Date().toISOString(),
    data: user,
  });
});

const updateLoggedInUser = asyncErrorCatcher(async (req: Request, res: Response): Promise<void> => {
  const userToUpdate = req.body;
  validatePatchRequestBody(userToUpdate);
  const loggedInUserId = getLoggedInUserIdFromReq();
  if (!loggedInUserId) throw new AppError("User not logged in", 401);
  const updatedUser = await userService.update(loggedInUserId, userToUpdate);

  res.send({
    status: "success",
    data: updatedUser,
  });
});

const removeLoggedInUser = asyncErrorCatcher(async (req: Request, res: Response): Promise<void> => {
  const loggedInUserId = getLoggedInUserIdFromReq();
  if (!loggedInUserId) throw new AppError("User not logged in", 401);

  await userService.removeAccount(loggedInUserId);

  res.status(204).send({
    status: "success",
    data: null,
  });
});

export {
  getUsers,
  getUserById,
  getUserByUsername,
  addUser,
  updateUser,
  removeUser,
  updateLoggedInUser,
  removeLoggedInUser,
};
