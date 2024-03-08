<template>
  <div class="filter">
    <button
      v-for="value in filterValues"
      :key="value.value"
      @click="onSetFilter(value.value)"
      :class="{ active: filterBy === value.value }"
    >
      {{ value.label }}
    </button>
  </div>
</template>
<script setup lang="ts">
import { defineEmits, defineProps } from "vue";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { Book, BookFilterBy } from "../../../../../shared/types/books";
import bookApiService from "../../../services/bookApiService";
import { cloneDeep } from "lodash";
const props = defineProps<{ book: Book; filterBy: BookFilterBy }>();
const queryClient = useQueryClient();
const mutation = useMutation({
  mutationFn: (newBook: Book) => bookApiService.update(newBook),
  onSuccess: () => {
    const { book } = props;
    queryClient.invalidateQueries({
      queryKey: ["book", book._id],
    });
  },
});

const filterValues = [
  {
    value: "chapters",
    label: "פרקים",
  },
  {
    value: "characters",
    label: "דמויות",
  },
  {
    value: "themes",
    label: "תמות",
  },
  {
    value: "plotlines",
    label: "קווי עלילה",
  },
  {
    value: "notes",
    label: "הערות",
  },
] as { value: BookFilterBy; label: string }[];

const emit = defineEmits(["filterBy"]);
function onSetFilter(value: BookFilterBy) {
  emit("filterBy", value);
  const { book } = props;
  if (!book) return;
  const newBook = cloneDeep(book) as Book;
  newBook.filterBy = value;
  mutation.mutate(newBook);
}
</script>
<style lang="scss" scoped>
.filter {
  display: flex;
  gap: 0.5em;
  margin-bottom: 1em;
  direction: rtl;

  button {
    padding: 0.5em 1em;
    border: none;
    border-radius: 0.5em;
    background-color: #f0f0f0;
    cursor: pointer;

    &.active {
      background-color: #e0e0e0;
      border: 1px solid #000;
    }
  }
}
</style>
