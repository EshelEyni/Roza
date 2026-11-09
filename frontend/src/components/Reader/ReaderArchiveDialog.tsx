import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "../Modals/ConfirmDialog";
export function ReaderArchiveDialog({
  title,
  onCancel,
  onConfirm,
}: {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ConfirmDialog
      title={t("reader.archiveDialogTitle")}
      message={t("reader.confirmArchiveBook", { title })}
      cancelLabel={t("btnCancel")}
      confirmLabel={t("reader.archiveBook")}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
