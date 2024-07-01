import { ParsedReqQuery } from "../../types/app";
import { IUser } from "../../types/iTypes";
import { User } from "../../../../shared/types/user";
import { UserModel } from "../../models/user/userModel";
import { APIFeatures, filterObj } from "../../services/util/utilService";
import { AppError } from "../../services/error/errorService";
import { logger } from "../../services/logger/loggerService";

async function query(queryString: ParsedReqQuery): Promise<IUser[]> {
  const features = new APIFeatures(UserModel.find(), queryString)
    .filter()
    .sort()
    .limitFields()
    .paginate();
  const users = (await features.getQuery().exec()) as unknown as IUser[];
  return users;
}

async function getUsers(...userIds: string[]): Promise<IUser[]> {
  const users = await UserModel.find({ _id: { $in: userIds } })
    .lean()
    .exec();
  return users;
}

async function getById(userId: string): Promise<IUser> {
  const user = await UserModel.findById(userId).exec();
  if (!user) throw new AppError(`User with id ${userId} not found`, 404);
  return user;
}

async function getByUsername(username: string): Promise<IUser> {
  const user = await UserModel.findOne({ username }).exec();
  if (!user) throw new AppError(`User with username ${username} not found`, 404);
  return user;
}

async function add(user: User): Promise<IUser> {
  const savedUser = await new UserModel(user).save();
  return savedUser;
}

async function update(id: string, user: User): Promise<User> {
  const allowedFields: Array<keyof User> = [
    "username",
    "email",
    "fullname",
    "imgUrl",
    "email",
    "height",
    "weight",
    "targetCaloricIntakePerDay",
    "totalDailyEnergyExpenditure",
    "workoutSchedule",
  ];

  const filteredUser = filterObj(user, ...allowedFields);

  const updatedUser = await UserModel.findByIdAndUpdate(id, filteredUser, {
    new: true,
    runValidators: true,
  }).exec();
  if (!updatedUser) throw new AppError("User not found", 404);
  return updatedUser as unknown as User;
}

async function remove(userId: string): Promise<User> {
  const userRemoved = await UserModel.findByIdAndRemove(userId).exec();
  return userRemoved as unknown as User;
}

async function removeAccount(userId: string): Promise<User> {
  const removedUser = (await UserModel.findByIdAndUpdate(userId, {
    active: false,
  }).exec()) as unknown as User;
  if (!removedUser) throw new AppError("User not found", 404);
  logger.warn(`User ${removedUser.username} was deactivated`);

  return removedUser as unknown as User;
}

export default {
  query,
  getById,
  getByUsername,
  add,
  update,
  remove,
  removeAccount,
  getUsers,
};
