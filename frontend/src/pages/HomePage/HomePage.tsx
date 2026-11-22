import { FC, useState } from "react";
import { useLoginWithToken } from "../../hooks/reactQuery/get/useLoginWithToken";
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";
import { useFeatureAccess } from "../../hooks/useFeatureAccess";
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
  const studioAccess = useFeatureAccess("writingStudio");
  const {
    books,
    errorBooks,
    isLoadingBooks,
    isSuccessBooks,
    isErrorBooks,
    isBooksAvailable,
    isNoBooks,
  } = useGetBooks({
    enabled: studioAccess,
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

  return (
    <Main>
      {isLoadingLoggedInUser && <Loader />}
      {!loggedInUser && !isLoadingLoggedInUser && (
        <section className="mt-12 flex w-[min(440px,calc(100%-32px))] flex-col items-center gap-6">
          {openedForm === "login" && <LoginForm />}
          {openedForm === "signup" && <SignupForm />}

          <P className="mb-12 font-[Georgia,serif] text-base italic text-[color:var(--roza-ink-2)]">
            {toggleFormTitle}{" "}
            <button
              type="button"
              onClick={onToggleForm}
              className="font-semibold not-italic text-[color:var(--roza-brand)] underline underline-offset-4"
            >
              {openedForm === "login" ? t("signup") : t("login")}
            </button>
          </P>
        </section>
      )}

      {loggedInUser && (
        <PageContent>
          <H1
            addedClass="ui-clickable"
            onClick={onGoToProfile}
          >
            {loggedInUser.username}
          </H1>
          <Hr />
          {studioAccess && (
            <>
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
            </>
          )}
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
        </PageContent>
      )}
    </Main>
  );
};

export default HomePage;
