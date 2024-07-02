import { FC, LazyExoticComponent, ReactElement, ReactNode } from "react";

type RouteProvider = ({
  children,
}: {
  children: ReactNode;
}) => ReactElement<
  { children: ReactNode },
  string | ((props: unknown) => JSX.Element)
>;

export interface Route {
  path: string;
  component: LazyExoticComponent<FC>;
  nestedRoutes?: Route[];
  authRequired: boolean;
  provider?: RouteProvider;
}

export type UpdatePasswordParams = {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirm: string;
};
