import { useTranslation } from "react-i18next";
import { GiNotebook, GiBookPile, GiHouse } from "react-icons/gi";
import { RiTaskLine, RiUpload2Fill, RiUserFill } from "react-icons/ri";
import { useFeatureAccess } from "../../hooks/useFeatureAccess";
import { useStagingRoomAccess } from "../../hooks/useStagingRoomAccess";

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
  const readerAccess = useFeatureAccess("reader");
  const studioAccess = useFeatureAccess("writingStudio");
  const devBoardAccess = useFeatureAccess("devBoard");
  const stagingRoomAccess = useStagingRoomAccess();

  const links: MainNavLink[] = [
    { name: t("home"), icon: <GiHouse />, link: "/home" },
    { name: t("profile"), icon: <RiUserFill />, link: "/profile" },
    { name: t("myReviewsNav"), icon: <GiNotebook />, link: "/reviews" },
  ];
  if (readerAccess)
    links.push({
      name: t("reader.nav"),
      icon: readingRoomIcon,
      link: "/reader",
    });
  if (studioAccess) links.push({ name: t("writingStudioNav"), icon: <GiBookPile />, link: "/books" });
  if (stagingRoomAccess) {
    links.push({ name: t("stagingRoom.title"), icon: <RiUpload2Fill />, link: "/staging-room" });
  }
  if (devBoardAccess) links.push({ name: "Dev Board", icon: <RiTaskLine />, link: "/dev-board" });
  return links;
}

/** The main page a path belongs to, so the open reader counts as Reading Room. */
export function mainSectionOf(pathname: string) {
  if (pathname === "/dev-board") return "/dev-board";
  if (pathname === "/staging-room") return "/staging-room";
  if (pathname.startsWith("/reader")) return "/reader";
  if (pathname === "/books" || pathname.startsWith("/book-edit/"))
    return "/books";
  if (pathname.startsWith("/review")) return "/reviews";
  if (pathname.startsWith("/profile")) return "/profile";
  return "/home";
}
