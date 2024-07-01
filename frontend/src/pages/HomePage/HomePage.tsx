import { FC, useState } from "react";
import { useLoginWithToken } from "../../hooks/useLoginWithToken";
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";
import { Button } from "../../components/Button";
import { useLogout } from "../../hooks/useLogout";
import { useGetBooks } from "../../hooks/useGetBooks";

type FormType = "login" | "signup";

const HomePage: FC = () => {
  const { loggedInUser } = useLoginWithToken();
  const { books, error, isLoading, isSuccess, isError } = useGetBooks({
    userId: loggedInUser?.id || "",
  });

  console.log({ books, error, isLoading, isSuccess, isError });
  const { logout } = useLogout();
  const [openedForm, setOpenedForm] = useState<FormType>("login");

  const toggleFormTitle =
    openedForm === "login"
      ? "Don't have an account?"
      : "Already have an account?";

  function toggleForm() {
    setOpenedForm(openedForm === "login" ? "signup" : "login");
  }

  function handleLogout() {
    logout();
  }

  if (!loggedInUser) {
    return (
      <main className="h-full w-full bg-app-100 pt-12">
        <div className="flex h-full flex-col items-center">
          {openedForm === "login" && <LoginForm />}
          {openedForm === "signup" && <SignupForm />}

          <p className="mt-4 font-medium italic text-app-700">
            {toggleFormTitle}{" "}
            <Button
              onClickFn={toggleForm}
              className="text-app-700 hover:text-app-900 hover:underline"
            >
              {openedForm === "login" ? "Sign up" : "Log in"}
            </Button>
          </p>
        </div>
      </main>
    );
  }
  return (
    <main className="h-full w-full bg-app-100">
      <div className="flex items-center gap-8 p-5">
        <h1 className="text-3xl font-bold text-app-800">
          {loggedInUser.username}
        </h1>
        <Button
          onClickFn={handleLogout}
          className="rounded bg-app-600 px-4 py-2 text-white"
        >
          Logout
        </Button>
      </div>
    </main>
  );
};

export default HomePage;
