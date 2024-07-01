import crypto from "crypto";
import { User, UserCredenitials } from "../../../../shared/types/user";
import { UserModel } from "../../models/user/userModel";
import { AppError } from "../error/errorService";
import { isValidMongoId, sendEmail } from "../util/utilService";
import tokenService from "../token/tokenService";
import { IUser } from "../../types/iTypes";

type UserAuthResult = { user: User; token: string };
async function login(username: string, password: string): Promise<UserAuthResult> {
  const user = await UserModel.findOne({ username }).select("+password");
  if (!user) throw new AppError("User not found", 404);
  _checkIsUserLocked(user);
  await _checkLoginAttempts(user);
  await _validateUserPassword(user, password);
  await _resetLoginAttempts(user);
  return { user: user as unknown as User, token: tokenService.signToken(user.id) };
}

async function loginWithToken(loginToken: string): Promise<UserAuthResult> {
  const verifiedToken = await tokenService.verifyToken(loginToken);
  if (!verifiedToken) throw new AppError("Invalid token", 400);
  const { id } = verifiedToken;
  if (!isValidMongoId(id)) throw new AppError("Invalid Id", 400);
  const user = await UserModel.findById(id);
  if (!user) throw new AppError("User not found", 404);
  return { user: user as unknown as User, token: tokenService.signToken(user.id) };
}

async function signup(userCreds: UserCredenitials): Promise<UserAuthResult> {
  const user = await UserModel.create(userCreds);
  const token = tokenService.signToken(user.id);
  return { user: user as unknown as User, token };
}

async function updatePassword(
  loggedInUserId: string,
  currentPassword: string,
  newPassword: string,
  newPasswordConfirm: string
): Promise<UserAuthResult> {
  const user = await UserModel.findById(loggedInUserId).select("+password");
  if (!user) throw new AppError("User not found", 404);
  if (!(await user.checkPassword(currentPassword, user.password)))
    throw new AppError("Current password is incorrect. Please enter the correct password", 400);
  (user.password = newPassword), (user.passwordConfirm = newPasswordConfirm);
  await user.save();
  const token = tokenService.signToken(user.id);
  return { user: user as unknown as User, token };
}

async function sendPasswordResetEmail(email: string, resetURL: string) {
  const user = await UserModel.findOne({ email });
  if (!user) throw new AppError("There is no user with email address", 404);
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });
  const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to: ${
    resetURL + resetToken
  }.\nIf you didn't forget your password, please ignore this email!`;

  try {
    await sendEmail({
      email: user.email,
      subject: "Your password reset token (valid for 10 min)",
      message,
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    throw new AppError("There was an error sending the email. Try again later!", 500);
  }
}

async function resetPassword(
  token: string,
  password: string,
  passwordConfirm: string
): Promise<UserAuthResult> {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const user = await UserModel.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  if (!user) throw new AppError("Token is invalid or has expired", 400);
  (user.password = password), (user.passwordConfirm = passwordConfirm);
  user.passwordResetToken = user.passwordResetExpires = undefined;
  await user.save();
  return { user: user as unknown as User, token: tokenService.signToken(user.id) };
}

function _checkIsUserLocked(user: IUser) {
  if (user?.lockedUntil < Date.now()) return;
  const minutes = Math.ceil((user.lockedUntil - Date.now()) / 1000 / 60);
  throw new AppError(`Account locked. Try again in ${minutes} minutes`, 400);
}

async function _validateUserPassword(user: IUser, password: string) {
  const isValidPassword = await user.checkPassword(password, user.password);
  user.loginAttempts++;
  await user.save({ validateBeforeSave: false });
  if (!isValidPassword) throw new AppError("Incorrect password", 401);
}

async function _checkLoginAttempts(user: IUser) {
  if (user.loginAttempts < 10) return;
  const HOUR = 60 * 60 * 1000;
  user.lockedUntil = Date.now() + HOUR;
  await user.save({ validateBeforeSave: false });
  throw new AppError("Too many failed login attempts. Try again in 1 hour", 400);
}

async function _resetLoginAttempts(user: IUser) {
  user.loginAttempts = 0;
  user.lockedUntil = 0;
  await user.save({ validateBeforeSave: false });
}

export default {
  login,
  loginWithToken,
  signup,
  sendPasswordResetEmail,
  resetPassword,
  updatePassword,
};
