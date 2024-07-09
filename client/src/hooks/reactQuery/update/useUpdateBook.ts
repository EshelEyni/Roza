import { useMutation, useQueryClient } from "@tanstack/react-query";
import bookApiService from "../../../services/bookApiService";
import { Book, BooKDataItemType } from "@rozaeyni/common-types";
import { useNavigate } from "react-router-dom";

export function useUpdateBook(dataItemType?: BooKDataItemType) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { mutate: updateBook, isPending: isPendingUpdateBook } = useMutation({
    mutationFn: async (book: Book) => bookApiService.update(book),
    onSuccess: data => {
      queryClient.invalidateQueries({
        queryKey: ["book", data.id],
      });
      if (!dataItemType) return;
      const dataItemId = data[dataItemType][data[dataItemType].length - 1].id;
      navigate(`/book-edit/${data.id}/${dataItemType}/${dataItemId}`);
    },
  });

  return { updateBook, isPendingUpdateBook };
}
