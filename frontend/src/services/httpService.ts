import axios, { AxiosError, Method } from "axios";
import { JsendResponse, ServerErrorData } from "../../../shared/types/system";
const isProd = process.env.NODE_ENV === "production";
// const BASE_URL = isProd ? "/api/" : "http://localhost:3030/api/";
const BASE_URL = isProd
  ? "/api/"
  : "https://0175-2a06-c701-4840-4e00-490a-e3d7-951d-5605.ngrok-free.app/api/";

async function ajax(
  endpoint: string,
  method: Method = "GET",
  data: object | null = null,
): Promise<JsendResponse> {
  try {
    const res = await axios({
      url: `${BASE_URL}${endpoint}`,
      method,
      data,
      params: method === "GET" ? data : null,
      withCredentials: true,
    });

    return res.data;
  } catch (error) {
    if (!isProd) console.error(error);
    const errorData = (error as unknown as AxiosError).response
      ?.data as ServerErrorData;
    return {
      status: "fail",
      data: errorData,
    } as JsendResponse<ServerErrorData>;
  }
}

export default {
  get(endpoint: string, data?: object) {
    return ajax(endpoint, "GET", data);
  },
  post(endpoint: string, data?: object) {
    return ajax(endpoint, "POST", data);
  },
  put(endpoint: string, data?: object) {
    return ajax(endpoint, "PUT", data);
  },
  patch(endpoint: string, data?: object) {
    return ajax(endpoint, "PATCH", data);
  },
  delete(endpoint: string, data?: object) {
    return ajax(endpoint, "DELETE", data);
  },
};
