import { FC, cloneElement } from "react";
import { useTranslation } from "react-i18next";
import { GiNotebook, GiBookPile, GiHouse } from "react-icons/gi";
import { RiUserFill } from "react-icons/ri";
import { Link } from "react-router-dom";
type NavLinks = {
  name: string;
  icon: JSX.Element;
  link: string;
};

export const AppHeader: FC = () => {
  const { t } = useTranslation();
  const navLinks: NavLinks[] = [
    {
      name: t("AppHeader.home"),
      icon: <GiHouse />,
      link: "/home",
    },
    {
      name: t("AppHeader.profile"),
      icon: <RiUserFill />,
      link: "/profile",
    },
    {
      name: t("AppHeader.books"),
      icon: <GiBookPile />,
      link: "/books",
    },
    {
      name: t("AppHeader.reviews"),
      icon: <GiNotebook />,
      link: "/reviews",
    },
  ];

  return (
    <header className="flex w-full items-center justify-between bg-app-700 px-3 py-2 md:px-3 md:py-1">
      <nav className="flex items-center gap-2 md:gap-3">
        {navLinks.map(({ name, icon, link }) => (
          <Link key={name} to={link} color="blue">
            {cloneElement(icon, {
              className:
                "text-app-100 cursor-pointer md:text-5xl text-white transition duration-300 ease-in-out hover:text-sky-600 md:hidden text-2xl hover:text-app-300",
            })}
            <span className="hidden text-xl font-medium uppercase text-app-100 transition duration-300  ease-in-out hover:text-app-300 md:block">
              {name}
            </span>
          </Link>
        ))}
      </nav>
    </header>
  );
};
