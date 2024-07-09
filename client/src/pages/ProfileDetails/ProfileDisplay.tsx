import { FC } from "react";
import { useTranslation } from "react-i18next";
import { useLoginWithToken } from "../../hooks/reactQuery/get/useLoginWithToken";
import { formatDateByLang, formatLang } from "../../services/utilService";

export const ProfileDisplay: FC = () => {
  const { loggedInUser } = useLoginWithToken();
  const { t } = useTranslation();

  if (!loggedInUser) return null;
  const formmatedDate = formatDateByLang(
    loggedInUser.createdAt,
    loggedInUser.language,
  );
  const formmatedLanguage = formatLang(loggedInUser.language);

  return (
    <section className="mt-5 rounded-lg bg-app-200 p-6 text-app-800">
      <p className="mb-2">
        <strong>{t("ProfileDisplay.username")}:</strong> {loggedInUser.username}
      </p>
      <p className="mb-2">
        <strong>{t("ProfileDisplay.fullName")}:</strong> {loggedInUser.fullname}
      </p>
      <p className="mb-2">
        <strong>{t("ProfileDisplay.email")}:</strong> {loggedInUser.email}
      </p>
      <p className="mb-2">
        <strong>{t("ProfileDisplay.language")}:</strong> {formmatedLanguage}
      </p>

      <p className="mb-2">
        <strong>{t("ProfileDisplay.signup")}:</strong> {formmatedDate}
      </p>
    </section>
  );
};
