import axios, { Method } from "axios";
const isProd = process.env.NODE_ENV === "production";

type HTTPParams = {
  endpoint: string;
  method?: Method;
  data?: object | null;
  port?: number;
};

async function ajax({
  endpoint,
  method = "GET",
  data = null,
  port,
}: HTTPParams) {
  try {
    const BASE_URL = getBaseUrl(port);

    const res = await axios({
      url: `${BASE_URL}${endpoint}`,
      method,
      data,
      params: method === "GET" ? data : null,
      withCredentials: true,
    });

    return res.data;
  } catch (err) {
    if (isProd) return;
    if (data && "password" in data) delete data["password"];
    // eslint-disable-next-line no-console
    console.log(
      `Had issues ${method}ing to the backend, endpoint: ${endpoint}, with data: `,
      data,
    );
    console.error(err);
    throw err;
  }
}

function getBaseUrl(port?: number) {
  const env = process.env.NODE_ENV;

  switch (env) {
    case "production":
      return "/api/";
    case "development-k8s":
      return "http://roza.dev/api/";
    case "development":
      if (!port) throw new Error("Port is required in development mode");
      return `http://localhost:${port || 3000}/api/`;
    default:
      throw new Error("NODE_ENV is not set");
  }
}

export default {
  get({ port, endpoint, data }: HTTPParams) {
    return ajax({
      port,
      endpoint,
      method: "GET",
      data,
    });
  },
  post({ port, endpoint, data }: HTTPParams) {
    return ajax({
      port,
      endpoint,
      method: "POST",
      data,
    });
  },
  put({ port, endpoint, data }: HTTPParams) {
    return ajax({
      port,
      endpoint,
      method: "PUT",
      data,
    });
  },
  patch({ port, endpoint, data }: HTTPParams) {
    return ajax({
      port,
      endpoint,
      method: "PATCH",
      data,
    });
  },
  delete({ port, endpoint, data }: HTTPParams) {
    return ajax({
      port,
      endpoint,
      method: "DELETE",
      data,
    });
  },
};
