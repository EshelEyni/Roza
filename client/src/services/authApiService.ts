import { JsendResponse, User, UserCredenitials } from "@rozaeyni/common-types";
import { UpdatePasswordParams } from "../types/app";
import httpService from "./httpService";
import { handleServerResponseData } from "./utilService";

const baseUrl = "auth";
const port = 3000;

async function loginWithToken(): Promise<User | null> {
  const response = (await httpService.get({
    endpoint: `${baseUrl}/login/with-token`,
    port,
  })) as unknown as JsendResponse;
  return handleServerResponseData<User>(response);
}

async function login(username: string, password: string): Promise<User> {
  const response = (await httpService.post({
    endpoint: `${baseUrl}/login`,
    data: {
      username,
      password,
    },
    port,
  })) as unknown as JsendResponse;

  return handleServerResponseData<User>(response);
}

async function signup(userCredentials: UserCredenitials): Promise<User> {
  const response = (await httpService.post({
    endpoint: `${baseUrl}/signup`,
    data: userCredentials,
    port,
  })) as unknown as JsendResponse;

  return handleServerResponseData<User>(response);
}

async function logout(): Promise<void> {
  const res = await httpService.post({
    endpoint: `${baseUrl}/logout`,
    port,
  });
  return res;
}

async function update(user: User): Promise<User> {
  const response = (await httpService.put({
    endpoint: `${baseUrl}/update`,
    data: user,
    port,
  })) as unknown as JsendResponse;

  return handleServerResponseData<User>(response);
}

async function updatePassword({
  currentPassword,
  newPassword,
  newPasswordConfirm,
}: UpdatePasswordParams): Promise<void> {
  const response = (await httpService.put({
    endpoint: `${baseUrl}/updatePassword`,
    data: {
      currentPassword,
      newPassword,
      newPasswordConfirm,
    },
    port,
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
