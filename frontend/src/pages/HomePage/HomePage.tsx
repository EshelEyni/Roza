import { FC, useState } from "react";
import { useLoginWithToken } from "../../hooks/reactQuery/get/useLoginWithToken";
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";
import { Button } from "../../components/Buttons/Button";
import { useLogout } from "../../hooks/reactQuery/update/useLogout";
import { useGetBooks } from "../../hooks/reactQuery/get/useGetBooks";
import { Loader } from "../../components/Loaders/Loader";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Main } from "../../components/Gen/Main";
import { BookList } from "../../components/Book/BookList";
import { useGetBookReviews } from "../../hooks/reactQuery/get/useGetBookReviews";
import { BookReviewList } from "../../components/BookReview/BookReviewList";
import { Hr } from "../../components/Gen/Hr";
import { PageContent } from "../../components/Gen/PageContent";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

type FormType = "login" | "signup";

const HomePage: FC = () => {
  useDocumentTitle("Roza / Home");

  const { t } = useTranslation();
  const { loggedInUser, isLoadingLoggedInUser } = useLoginWithToken();
  const {
    books,
    errorBooks,
    isLoadingBooks,
    isSuccessBooks,
    isErrorBooks,
    isBooksAvailable,
    isNoBooks,
  } = useGetBooks({
    enabled: !!loggedInUser,
    limit: 9,
    sort: "-createdAt",
  });

  const slicedBooks = books
    ?.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 9);

  const {
    reviews,
    errorReviews,
    isLoadingReviews,
    isSuccessReviews,
    isErrorReviews,
    isNoReviews,
    isReviewsAvailable,
  } = useGetBookReviews({
    enabled: !!loggedInUser,
    limit: 9,
    sort: "-sortOrder",
  });

  const slicedReviews = reviews?.slice(0, 9);

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
      {isLoadingLoggedInUser && <Loader />}
      {!loggedInUser && !isLoadingLoggedInUser && (
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
        <PageContent>
          <h1
            className="cursor-pointer font-alef text-3xl font-bold text-app-700 transition-colors hover:text-app-800 hover:underline"
            onClick={onGoToProfile}
          >
            {loggedInUser.username}
          </h1>

          <Hr />

          <BookList
            books={slicedBooks}
            errorBooks={errorBooks}
            isLoadingBooks={isLoadingBooks}
            isErrorBooks={isErrorBooks}
            isSuccessBooks={isSuccessBooks}
            isNoBooks={isNoBooks}
            isBooksAvailable={isBooksAvailable}
            isHomePage={true}
          />

          <Hr />

          <BookReviewList
            reviews={slicedReviews}
            errorReviews={errorReviews}
            isLoadingReviews={isLoadingReviews}
            isSuccessReviews={isSuccessReviews}
            isErrorReviews={isErrorReviews}
            isNoReviews={isNoReviews}
            isReviewsAvailable={isReviewsAvailable}
            isHomePage={true}
          />

          <Hr />

          <div className="flex w-full justify-end">
            <Button
              onClickFn={onLogout}
              className="rounded bg-app-600 px-4 py-2 text-white hover:bg-app-700"
            >
              {t("HomePage.btnLogout")}
            </Button>
          </div>
        </PageContent>
      )}
    </Main>
  );
};

export default HomePage;
