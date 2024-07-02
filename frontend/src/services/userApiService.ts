import { JsendResponse } from "../../../shared/types/system";
import { User } from "../../../shared/types/user";
import httpService from "./httpService";
import { handleServerResponseData } from "./utilService";

const baseUrl = "user";

async function query(): Promise<User[]> {
  const response = (await httpService.get(baseUrl)) as unknown as JsendResponse;
  return handleServerResponseData<User[]>(response);
}

async function getById(id: string): Promise<User> {
  const response = (await httpService.get(
    `${baseUrl}/${id}`,
  )) as unknown as JsendResponse;
  return handleServerResponseData<User>(response);
}

async function add(user: User): Promise<User> {
  const response = (await httpService.post(
    baseUrl,
    user,
  )) as unknown as JsendResponse;
  return handleServerResponseData<User>(response);
}

async function update(user: User): Promise<User> {
  const response = (await httpService.patch(
    `${baseUrl}/${user.id}`,
    user,
  )) as unknown as JsendResponse;
  return handleServerResponseData<User>(response);
}

async function remove(id: string): Promise<void> {
  const res = await httpService.delete(`${baseUrl}/${id}`);
  return res;
}

export default { query, getById, add, update, remove };
