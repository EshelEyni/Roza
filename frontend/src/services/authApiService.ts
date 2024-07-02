import { JsendResponse } from "../../../shared/types/system";
import { User, UserCredenitials } from "../../../shared/types/user";
import { UpdatePasswordParams } from "../types/app";
import httpService from "./httpService";
import { handleServerResponseData } from "./utilService";

const baseUrl = "auth";

async function loginWithToken(): Promise<User | null> {
  const response = (await httpService.get(
    `${baseUrl}/login/with-token`,
  )) as unknown as JsendResponse;
  return handleServerResponseData<User>(response);
}

async function login(username: string, password: string): Promise<User> {
  const response = (await httpService.post(`${baseUrl}/login`, {
    username,
    password,
  })) as unknown as JsendResponse;

  return handleServerResponseData<User>(response);
}

async function signup(userCredentials: UserCredenitials): Promise<User> {
  const response = (await httpService.post(
    `${baseUrl}/signup`,
    userCredentials,
  )) as unknown as JsendResponse;

  return handleServerResponseData<User>(response);
}

async function logout(): Promise<void> {
  const res = await httpService.post(`${baseUrl}/logout`);
  return res;
}

async function update(user: User): Promise<User> {
  const response = (await httpService.put(
    `${baseUrl}/update`,
    user,
  )) as unknown as JsendResponse;

  return handleServerResponseData<User>(response);
}

async function updatePassword({
  currentPassword,
  newPassword,
  newPasswordConfirm,
}: UpdatePasswordParams): Promise<void> {
  const response = (await httpService.put(`${baseUrl}/updatePassword`, {
    currentPassword,
    newPassword,
    newPasswordConfirm,
  })) as unknown as JsendResponse;

  return handleServerResponseData<void>(response);
}

export default {
  login,
  signup,
  logout,
  loginWithToken,
  update,
  updatePassword,
};
