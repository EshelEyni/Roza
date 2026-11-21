import { useTranslation } from "react-i18next";
import { GiNotebook, GiBookPile, GiHouse } from "react-icons/gi";
import { RiTaskLine, RiUpload2Fill, RiUserFill } from "react-icons/ri";
import { useLoginWithToken } from "../../hooks/reactQuery/get/useLoginWithToken";
import { useStagingRoomAccess } from "../../hooks/useStagingRoomAccess";
import { useGetReaderAccess } from "../../hooks/reactQuery/get/useGetReaderAccess";

export type MainNavLink = {
  name: string;
  icon: JSX.Element;
  link: string;
};

const readingRoomIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 5v16" />
    <path d="M16 13h2" />
    <path d="M16 9h2" />
    <path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z" />
    <path d="M6 13h2" />
    <path d="M6 9h2" />
  </svg>
);

/** The app's main pages, in header order. Reading Room shows only with reader access. */
export function useMainNavLinks(): MainNavLink[] {
  const { t } = useTranslation();
  const { data: readerAccess } = useGetReaderAccess();
  const { loggedInUser } = useLoginWithToken();
  const stagingRoomAccess = useStagingRoomAccess();

  const links: MainNavLink[] = [
    { name: t("home"), icon: <GiHouse />, link: "/home" },
    { name: t("profile"), icon: <RiUserFill />, link: "/profile" },
    { name: t("myReviewsNav"), icon: <GiNotebook />, link: "/reviews" },
    { name: t("writingStudioNav"), icon: <GiBookPile />, link: "/books" },
  ];
  if (readerAccess?.enabled)
    links.splice(3, 0, {
      name: t("reader.nav"),
      icon: readingRoomIcon,
      link: "/reader",
    });
  if (stagingRoomAccess) {
    links.push({ name: t("stagingRoom.title"), icon: <RiUpload2Fill />, link: "/staging-room" });
  }
  if (loggedInUser?.roles?.includes("admin")) links.push({ name: "Dev Board", icon: <RiTaskLine />, link: "/dev-board" });
  return links;
}

/** The main page a path belongs to, so the open reader counts as Reading Room. */
export function mainSectionOf(pathname: string) {
  if (pathname === "/dev-board") return "/dev-board";
  if (pathname === "/staging-room") return "/staging-room";
  if (pathname.startsWith("/reader")) return "/reader";
  if (pathname === "/books" || pathname.startsWith("/book/") || pathname.startsWith("/book-edit/"))
    return "/books";
  if (pathname.startsWith("/review")) return "/reviews";
  if (pathname.startsWith("/profile")) return "/profile";
  return "/home";
}
