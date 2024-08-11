import { FC } from "react";
import { useTranslation } from "react-i18next";
import { useLoginWithToken } from "../../hooks/reactQuery/get/useLoginWithToken";
import { formatDateByLang, formatLang } from "../../services/utilService";
import { P } from "../../components/App/P";

export const ProfileDisplay: FC = () => {
  const { loggedInUser } = useLoginWithToken();
  const { t } = useTranslation();

  if (!loggedInUser) return null;
  const formmatedDate = formatDateByLang(
    loggedInUser.createdAt,
    loggedInUser.language,
  );
  const formmatedLanguage = formatLang(loggedInUser.language);

  const list = [
    { key: t("username"), value: loggedInUser.username },
    { key: t("fullName"), value: loggedInUser.fullname },
    { key: t("email"), value: loggedInUser.email },
    { key: t("language"), value: formmatedLanguage },
    { key: t("signup"), value: formmatedDate },
  ];

  return (
    <section className="mt-5 flex flex-col gap-2 rounded-lg bg-app-200 p-6 text-app-800">
      {list.map(item => (
        <P key={item.key}>
          <strong>{item.key}:</strong> {item.value}
        </P>
      ))}
    </section>
  );
};
