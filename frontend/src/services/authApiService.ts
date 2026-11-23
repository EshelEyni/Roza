import axios from "axios";
import { connectionFailed, offlineAccount, rememberOfflineAccount } from "./offlineBooks";
import { JsendResponse } from "../../../shared/types/system";
import { User, UserCredenitials } from "../../../shared/types/user";
import { UpdatePasswordParams } from "../types/app";
import httpService from "./httpService";
import { handleServerResponseData } from "./utilService";

const baseUrl = "auth";

async function loginWithToken(): Promise<User | null> {
  try {
    const { data } = await axios.get<JsendResponse<User | null>>(
      `/api/${baseUrl}/login/with-token`, { withCredentials: true, timeout: 10000 },
    );
    const user = handleServerResponseData(data);
    await rememberOfflineAccount(user);
    return user;
  } catch (error) {
    if (connectionFailed(error)) {
      const user = await offlineAccount();
      if (user) return user;
    }
    if (axios.isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0)) {
      await rememberOfflineAccount(null);
    }
    throw error;
  }
}

async function login(username: string, password: string): Promise<User> {
  const response = (await httpService.post(`${baseUrl}/login`, {
    username,
    password,
  })) as unknown as JsendResponse;

  const user = handleServerResponseData<User>(response);
  await rememberOfflineAccount(user);
  return user;
}

async function signup(userCredentials: UserCredenitials): Promise<User> {
  const response = (await httpService.post(
    `${baseUrl}/signup`,
    userCredentials,
  )) as unknown as JsendResponse;

  const user = handleServerResponseData<User>(response);
  await rememberOfflineAccount(user);
  return user;
}

async function logout(): Promise<void> {
  await axios.post(`/api/${baseUrl}/logout`, null, { withCredentials: true });
  await rememberOfflineAccount(null);
}

async function update(user: User): Promise<User> {
  const response = (await httpService.patch(
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
  const response = (await httpService.patch(`${baseUrl}/updatePassword`, {
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
