import { Request, Response } from "express";
import { AppError, asyncErrorCatcher, getLoggedInUserIdFromReq } from "@rozaeyni/common";
import authService from "../service/authService";
import { User, UserCredenitials } from "@rozaeyni/common-types";

const login = asyncErrorCatcher(async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) throw new AppError("Username and password are required", 400);
  const { user, token } = await authService.login(username, password);
  _sendUserTokenSuccessResponse(res, token, user);
});

const loginWithToken = asyncErrorCatcher(async (req: Request, res: Response) => {
  const sendProdFailedResponse = () => {
    res.send({
      status: "success",
      data: null,
    });
  };
  try {
    const { rozaJwt } = req.cookies;
    if (!rozaJwt) throw new AppError("You are not logged in", 401);
    const { user, token } = await authService.loginWithToken(rozaJwt);
    _sendUserTokenSuccessResponse(res, token, user);
  } catch (err) {
    const isProdEnv = process.env.NODE_ENV === "production";
    if (!isProdEnv) throw err;
    return sendProdFailedResponse();
  }
});

const signup = asyncErrorCatcher(async (req: Request, res: Response) => {
  const userCreds = req.body as unknown as UserCredenitials;
  const { isValid, msg } = _validateUserCreds(userCreds);
  if (!isValid) throw new AppError(msg, 400);
  const { user, token } = await authService.signup(userCreds);
  _sendUserTokenSuccessResponse(res, token, user, 201);
});

const logout = asyncErrorCatcher(async (req: Request, res: Response) => {
  res.clearCookie("rozaJwt");
  res.send({
    status: "success",
    data: {
      msg: "Logged out successfully",
    },
  });
});

const updatePassword = asyncErrorCatcher(async (req: Request, res: Response) => {
  const { currentPassword, newPassword, newPasswordConfirm } = req.body;
  for (const field of ["currentPassword", "newPassword", "newPasswordConfirm"])
    if (!req.body[field]) throw new AppError(`${field} is required`, 400);

  if (newPassword !== newPasswordConfirm) throw new AppError("Passwords do not match", 400);
  const loggedInUserId = getLoggedInUserIdFromReq();
  if (!loggedInUserId) throw new AppError("You are not logged in", 401);
  const { user, token } = await authService.updatePassword(
    loggedInUserId,
    currentPassword,
    newPassword,
    newPasswordConfirm,
  );

  _sendUserTokenSuccessResponse(res, token, user);
});

const sendPasswordResetEmail = asyncErrorCatcher(async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) throw new AppError("Email is required", 400);
  if (!_isValidEmail(email)) throw new AppError("Email is invalid", 400);
  const resetURL = `${req.protocol}://${req.get("host")}/api/auth/resetPassword/`;
  await authService.sendPasswordResetEmail(email, resetURL);
  res.send({
    status: "success",
    message: "Password reset email sent successfully",
  });
});

const resetPassword = asyncErrorCatcher(async (req: Request, res: Response) => {
  const { token } = req.params;
  const { password, passwordConfirm } = req.body;
  for (const field of ["password", "passwordConfirm"])
    if (!req.body[field]) throw new AppError(`${field} is required`, 400);

  const { user, token: newToken } = await authService.resetPassword(
    token,
    password,
    passwordConfirm,
  );
  _sendUserTokenSuccessResponse(res, newToken, user);
});

const _sendUserTokenSuccessResponse = (res: Response, token: string, user: User, status = 200) => {
  const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
  const isProd = process.env.NODE_ENV === "production";

  res.cookie("rozaJwt", token, {
    expires: new Date(Date.now() + NINETY_DAYS),
    httpOnly: true,
    secure: isProd,
  });

  res.status(status).send({
    status: "success",
    token,
    data: user,
  });
};

const _validateUserCreds = (userCreds: UserCredenitials) => {
  const requiredFields: (keyof UserCredenitials)[] = [
    "username",
    "password",
    "passwordConfirm",
    "email",
    "fullname",
  ];
  const isUserCredsEmpty = Object.keys(userCreds).length === 0;
  if (isUserCredsEmpty) return { isValid: false, msg: "User credentials are required" };
  for (const field of requiredFields)
    if (!userCreds[field]) return { isValid: false, msg: `${field} is required` };
  return { isValid: true, msg: "" };
};

const _isValidEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export {
  login,
  loginWithToken,
  signup,
  logout,
  sendPasswordResetEmail,
  resetPassword,
  updatePassword,
};
