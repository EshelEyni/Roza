import { JsendResponse, User } from "@rozaeyni/common-types";
import httpService from "./httpService";
import { handleServerResponseData } from "./utilService";

const baseUrl = "user";
const port = 3000;

async function query(): Promise<User[]> {
  const response = (await httpService.get({
    endpoint: baseUrl,
    port,
  })) as unknown as JsendResponse;
  return handleServerResponseData<User[]>(response);
}

async function getById(id: string): Promise<User> {
  const response = (await httpService.get({
    endpoint: `${baseUrl}/${id}`,
    port,
  })) as unknown as JsendResponse;
  return handleServerResponseData<User>(response);
}

async function add(user: User): Promise<User> {
  const response = (await httpService.post({
    endpoint: baseUrl,
    data: user,
    port,
  })) as unknown as JsendResponse;
  return handleServerResponseData<User>(response);
}

async function update(user: User): Promise<User> {
  const response = (await httpService.patch({
    endpoint: `${baseUrl}/${user.id}`,
    data: user,
    port,
  })) as unknown as JsendResponse;
  return handleServerResponseData<User>(response);
}

async function remove(id: string): Promise<void> {
  const res = await httpService.delete({
    endpoint: `${baseUrl}/${id}`,
    port,
  });
  return res;
}

export default { query, getById, add, update, remove };
