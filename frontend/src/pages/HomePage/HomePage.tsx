import { FC, useState } from "react";
import { useLoginWithToken } from "../../hooks/useLoginWithToken";
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";
import { Button } from "../../components/Button";
import { useLogout } from "../../hooks/useLogout";
import { useGetBooks } from "../../hooks/useGetBooks";
import { Loader } from "../../components/Loader";
import { useTranslation } from "react-i18next";

type FormType = "login" | "signup";

const HomePage: FC = () => {
  const { t } = useTranslation();
  const { loggedInUser, isLoading: isLoadingUser } = useLoginWithToken();
  const { books, error, isLoading, isSuccess, isError } = useGetBooks({
    userId: loggedInUser?.id || "",
  });

  const { logout } = useLogout();
  const [openedForm, setOpenedForm] = useState<FormType>("login");

  const toggleFormTitle =
    openedForm === "login"
      ? t("HomePage.formTitle.login")
      : t("HomePage.formTitle.signup");

  function toggleForm() {
    setOpenedForm(openedForm === "login" ? "signup" : "login");
  }

  function handleLogout() {
    logout();
  }

  return (
    <main className="relative flex h-full w-full flex-col items-center bg-app-100">
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
              onClickFn={toggleForm}
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
        <section className="flex items-center gap-8 p-5">
          <h1 className="font-alef text-3xl font-bold text-app-800">
            {loggedInUser.username}
          </h1>

          <Button
            onClickFn={handleLogout}
            className="rounded bg-app-600 px-4 py-2 text-white"
          >
            {t("HomePage.btnLogout")}
          </Button>
        </section>
      )}
    </main>
  );
};

export default HomePage;
