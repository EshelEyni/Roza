import { FC, cloneElement } from "react";
import { useTranslation } from "react-i18next";
import { GiNotebook, GiBookPile, GiHouse } from "react-icons/gi";
import { RiUserFill } from "react-icons/ri";
import { Link } from "react-router-dom";
import { Logo } from "./Logo";
import { useGetReaderAccess } from "../../hooks/reactQuery/get/useGetReaderAccess";

type NavLinks = {
  name: string;
  icon: JSX.Element;
  link: string;
};

export const AppHeader: FC = () => {
  const { t } = useTranslation();
  const { data: readerAccess } = useGetReaderAccess();

  const navLinks: NavLinks[] = [
    {
      name: t("home"),
      icon: <GiHouse />,
      link: "/home",
    },
    {
      name: t("profile"),
      icon: <RiUserFill />,
      link: "/profile",
    },
    {
      name: t("books"),
      icon: <GiBookPile />,
      link: "/books",
    },
    {
      name: t("reviews"),
      icon: <GiNotebook />,
      link: "/reviews",
    },
  ];

  if (readerAccess?.enabled)
    navLinks.push({
      name: t("reader.nav"),
      icon: (
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
      ),
      link: "/reader",
    });

  return (
    <header className="flex h-16 w-full items-center justify-between bg-app-700 px-3 py-2 md:px-3 md:py-1">
      <span className="app-header-status-surface" aria-hidden="true" />
      <nav className="flex items-center gap-3">
        {navLinks.map(({ name, icon, link }) => (
          <Link key={name} to={link}>
            {cloneElement(icon, {
              className:
                "text-app-100 cursor-pointer transition duration-300 ease-in-out md:hidden text-4xl hover:text-app-300",
            })}
            <span className="hidden text-2xl font-medium uppercase text-app-100 transition duration-300  ease-in-out hover:text-app-300 md:block">
              {name}
            </span>
          </Link>
        ))}
      </nav>
      <Logo className="h-14 w-14 md:h-12 md:w-12" isLink={true} />
    </header>
  );
};
