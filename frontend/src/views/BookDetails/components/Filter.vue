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
import { defineEmits, defineProps, toRaw } from "vue";
import { Book, BookFilterBy } from "../../../../../shared/types/books";
import { useRoute } from "vue-router";
import { useUpdateBook } from "../../../composables/useUpdateBook";

const route = useRoute();
const bookId = route.query.id as string;
const updateBook = useUpdateBook(bookId);
const props = defineProps<{ book: Book; filterBy: BookFilterBy }>();

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
  const newBook = toRaw(book) as Book;
  newBook.filterBy = value;
  updateBook(newBook);
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
