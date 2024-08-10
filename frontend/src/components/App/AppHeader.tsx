import { FC, cloneElement } from "react";
import { useTranslation } from "react-i18next";
import { GiNotebook, GiBookPile, GiHouse } from "react-icons/gi";
import { RiUserFill } from "react-icons/ri";
import { Link } from "react-router-dom";
import { Logo } from "./Logo";

type NavLinks = {
  name: string;
  icon: JSX.Element;
  link: string;
};

export const AppHeader: FC = () => {
  const { t } = useTranslation();

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

  return (
    <header className="flex h-16 w-full items-center justify-between bg-app-700 px-3 py-2 md:px-3 md:py-1">
      <nav className="flex items-center gap-2 md:gap-3">
        {navLinks.map(({ name, icon, link }) => (
          <Link key={name} to={link}>
            {cloneElement(icon, {
              className:
                "text-app-100 cursor-pointer transition duration-300 ease-in-out md:hidden text-3xl hover:text-app-300",
            })}
            <span className="hidden text-xl font-medium uppercase text-app-100 transition duration-300  ease-in-out hover:text-app-300 md:block">
              {name}
            </span>
          </Link>
        ))}
      </nav>
      <Logo className="h-14 w-14 md:h-12 md:w-12" isLink={true} />
    </header>
  );
};
