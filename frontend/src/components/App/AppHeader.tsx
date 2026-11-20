import { FC, cloneElement } from "react";
import { NavLink } from "react-router-dom";
import { Logo } from "./Logo";
import { useMainNavLinks } from "./useMainNavLinks";

export const AppHeader: FC = () => {
  const navLinks = useMainNavLinks();

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
