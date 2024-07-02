import { FC, useState } from "react";
import { useLoginWithToken } from "../../hooks/useLoginWithToken";
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";
import { Button } from "../../components/Button";
import { useLogout } from "../../hooks/useLogout";
import { useGetBooks } from "../../hooks/useGetBooks";
import { Loader } from "../../components/Loader";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Main } from "../../components/Main";

type FormType = "login" | "signup";

const HomePage: FC = () => {
  const { t } = useTranslation();
  const { loggedInUser, isLoading: isLoadingUser } = useLoginWithToken();
  const { books, error, isLoading, isSuccess, isError } = useGetBooks({
    userId: loggedInUser?.id || "",
  });

  const { logout } = useLogout();
  const [openedForm, setOpenedForm] = useState<FormType>("login");

  const navigate = useNavigate();

  const toggleFormTitle =
    openedForm === "login"
      ? t("HomePage.formTitle.login")
      : t("HomePage.formTitle.signup");

  function onToggleForm() {
    setOpenedForm(openedForm === "login" ? "signup" : "login");
  }

  function onGoToProfile() {
    if (!loggedInUser) return;
    navigate(`/profile`);
  }

  function onLogout() {
    logout();
  }

  return (
    <Main>
      {isLoadingUser && (
        <Loader className="absolute left-1/2 top-1/2 flex h-96 w-96 -translate-x-1/2 -translate-y-1/2 transform items-center justify-center" />
      )}
      {!loggedInUser && !isLoadingUser && (
        <section className="mt-12 flex h-full flex-col items-center md:min-w-96">
          {openedForm === "login" && <LoginForm />}
          {openedForm === "signup" && <SignupForm />}

          <p className="mt-4 font-medium italic text-app-700">
            {toggleFormTitle}{" "}
            <Button
              onClickFn={onToggleForm}
              className="text-app-700 hover:text-app-900 hover:underline"
            >
              {openedForm === "login"
                ? t("HomePage.btnForm.signup")
                : t("HomePage.btnForm.login")}
            </Button>
          </p>
        </section>
      )}

      {loggedInUser && (
        <section className="flex w-full max-w-[800px] flex-col items-center justify-center gap-8 p-5">
          <h1
            className="cursor-pointer font-alef text-3xl font-bold text-app-700 transition-colors hover:text-app-800 hover:underline"
            onClick={onGoToProfile}
          >
            {loggedInUser.username}
          </h1>

          <div className="flex w-full justify-end">
            <Button
              onClickFn={onLogout}
              className="rounded bg-app-600 px-4 py-2 text-white"
            >
              {t("HomePage.btnLogout")}
            </Button>
          </div>
        </section>
      )}
    </Main>
  );
};

export default HomePage;
