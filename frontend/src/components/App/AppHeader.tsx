import { FC, cloneElement } from "react";
import { useTranslation } from "react-i18next";
import { GiNotebook, GiBookPile, GiHouse } from "react-icons/gi";
import { RiUserFill } from "react-icons/ri";
import { NavLink } from "react-router-dom";
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
      name: t("myReviewsNav"),
      icon: <GiNotebook />,
      link: "/reviews",
    },
    {
      name: t("writingStudioNav"),
      icon: <GiBookPile />,
      link: "/books",
    },
  ];

  if (readerAccess?.enabled)
    navLinks.splice(3, 0, {
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
    <header className="app-main-header">
      <span className="app-header-status-surface" aria-hidden="true" />
      <nav className="app-main-nav" aria-label="Main navigation">
        {navLinks.map(({ name, icon, link }) => (
          <NavLink key={link} to={link} aria-label={name}
            className={({ isActive }) => "app-main-tab" + (isActive ? " is-active" : "")}>
            {cloneElement(icon, {
              className:
                "app-main-tab-icon",
            })}
            <span className="app-main-tab-label">
              {name}
            </span>
          </NavLink>
        ))}
      </nav>
      <Logo className="app-main-logo" isLink={true} />
    </header>
  );
};
