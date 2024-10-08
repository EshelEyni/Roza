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
import { Main } from "../../components/App/Main";
import { BookList } from "../../components/Book/BookList";
import { useGetBookReviews } from "../../hooks/reactQuery/get/useGetBookReviews";
import { BookReviewList } from "../../components/BookReview/BookReviewList";
import { Hr } from "../../components/App/Hr";
import { PageContent } from "../../components/App/PageContent";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { P } from "../../components/App/P";
import { H1 } from "../../components/App/H1";

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
      ? t("authFormTitle.login")
      : t("authFormTitle.signup");

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
        <section className="mt-12 flex h-full w-11/12 flex-col items-center sm:!w-7/12 md:!w-auto md:min-w-96">
          {openedForm === "login" && <LoginForm />}
          {openedForm === "signup" && <SignupForm />}

          <P className="mb-12 mt-4 text-2xl italic text-app-700 md:text-xl">
            {toggleFormTitle}{" "}
            <span
              onClick={onToggleForm}
              className="cursor-pointer text-app-800 hover:underline"
            >
              {openedForm === "login" ? t("signup") : t("login")}
            </span>
          </P>
        </section>
      )}

      {loggedInUser && (
        <PageContent>
          <H1
            addedClass="cursor-pointer hover:text-app-800 hover:underline"
            onClick={onGoToProfile}
          >
            {loggedInUser.username}
          </H1>
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
            <Button onClick={onLogout}>{t("btnLogout")}</Button>
          </div>
        </PageContent>
      )}
    </Main>
  );
};

export default HomePage;
