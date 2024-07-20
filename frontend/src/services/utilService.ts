import { SlateCustomElement } from "../../../shared/types/books";
import {
  AnyFunction,
  JsendResponse,
  UserMsg,
} from "../../../shared/types/system";
// eslint-disable-next-line @typescript-eslint/no-explicit-any

const SECONDS_IN_MINUTE = 60;
const MINUTES_IN_HOUR = 60;
const HOURS_IN_DAY = 24;
const DAYS_IN_YEAR = 365;
const TWELVE_HOURS = 12;
const TEN_MINUTES = 10;

const months = [
  { full: "January", short: "Jan" },
  { full: "February", short: "Feb" },
  { full: "March", short: "Mar" },
  { full: "April", short: "Apr" },
  { full: "May", short: "May" },
  { full: "June", short: "Jun" },
  { full: "July", short: "Jul" },
  { full: "August", short: "Aug" },
  { full: "September", short: "Sep" },
  { full: "October", short: "Oct" },
  { full: "November", short: "Nov" },
  { full: "December", short: "Dec" },
];

function isValidDate(dateStr: string) {
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

function getCleanTime(dateStr: string): string {
  if (!dateStr || !isValidDate(dateStr)) return "";
  const date = new Date(dateStr);
  let hours = date.getHours();
  const minutes = date.getMinutes();

  const ampm = hours >= TWELVE_HOURS ? "PM" : "AM";
  hours = hours % TWELVE_HOURS || TWELVE_HOURS;
  const minutesStr = minutes < TEN_MINUTES ? `0${minutes}` : minutes;

  return `${hours}:${minutesStr} ${ampm}`;
}

function formatDateToRelativeTime(dateStr: string): string {
  if (!dateStr || !isValidDate(dateStr)) return "";
  const [seconds, minutes, hours, days] = _calculateTimeDifference(dateStr);

  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.toLocaleString("en", { month: "short" });
  const day = date.getDate();

  if (days > DAYS_IN_YEAR) return `${month} ${day}, ${year}`;
  if (days > 0) return `${month} ${day}`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return seconds === 0 ? "now" : `${seconds}s`;
}

function _calculateTimeDifference(
  dateStr: string,
): [number, number, number, number] {
  const timestamp = new Date(dateStr).getTime();
  const now = Date.now();
  const difference = now - timestamp;
  const seconds = Math.floor(difference / 1000);
  const minutes = Math.floor(seconds / SECONDS_IN_MINUTE);
  const hours = Math.floor((minutes / MINUTES_IN_HOUR) * 10) / 10;
  const days = Math.floor(hours / HOURS_IN_DAY);
  return [seconds, minutes, hours, days];
}

function formatDateToCleanString(dateStr: string): string {
  if (!dateStr || !isValidDate(dateStr)) return "";
  const date = new Date(dateStr);
  let hours = date.getHours();
  const minutes = date.getMinutes();

  const ampm = hours >= TWELVE_HOURS ? "PM" : "AM";
  hours = hours % TWELVE_HOURS || TWELVE_HOURS;
  const minutesStr = minutes < TEN_MINUTES ? `0${minutes}` : minutes;

  const strTime = `${hours}:${minutesStr} ${ampm}`;
  const month = months[date.getMonth()].short;
  const day = date.getDate();
  const year = date.getFullYear();

  return `${strTime} · ${month} ${day}, ${year}`;
}

function debounce(
  func: AnyFunction,
  delay: number,
): { debouncedFunc: AnyFunction; cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const debouncedFunc = function (this: any, ...args: any[]) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
  const cancel = () => {
    clearTimeout(timeoutId);
  };
  return { debouncedFunc, cancel };
}

function handleServerResponseData<T>(response: JsendResponse<T>): T {
  if (response.status === "success") return response.data as T;

  if (response.status === "fail") {
    const errorMessages = Object.entries(
      response.data as Record<string, string>,
    )
      .map(([field, message]) => `${field}: ${message}`)
      .join(", ");
    throw new Error(errorMessages);
  }

  throw new Error("Unexpected response status");
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result && typeof reader.result === "string")
        resolve(reader.result);
      else reject(new Error("Failed to read file."));
    };
    reader.readAsDataURL(file);
  });
}

function getBasePathName(path: string, currNestedPath: string): string {
  const pathSegments = path.split("/");
  const currNestedPathSegmentIdx = pathSegments.findIndex(
    segment => segment === currNestedPath,
  );
  if (currNestedPathSegmentIdx === -1) return "/home";
  const basePath = pathSegments.slice(0, currNestedPathSegmentIdx).join("/");
  return basePath;
}

function getDefaultErrorMsg(): UserMsg {
  return {
    type: "error",
    text: "Something went wrong, but don’t fret — let’s give it another shot.",
  };
}

function capitializeFirstLetter(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDateByLang(date: Date | string, lang = "en") {
  const formmatedDate = new Date(date).toLocaleString(
    lang === "en" ? "en-US" : "he-IL",
    {
      dateStyle: "full",
    },
  );

  return formmatedDate;
}

function formatLang(lang: string): string {
  return lang === "en" ? "English" : "עברית";
}

function getLanguages() {
  const languages = [
    { name: "English", value: "en" },
    { name: "עברית", value: "he" },
  ];

  return languages;
}

function getDefaultSlateElement(text = ""): SlateCustomElement[] {
  return [{ type: "paragraph", children: [{ text }] }];
}

export {
  getCleanTime,
  formatDateToRelativeTime,
  debounce,
  handleServerResponseData,
  copyToClipboard,
  formatDateToCleanString,
  readAsDataURL,
  getBasePathName,
  getDefaultErrorMsg,
  capitializeFirstLetter,
  formatDateByLang,
  formatLang,
  getLanguages,
  getDefaultSlateElement,
};
