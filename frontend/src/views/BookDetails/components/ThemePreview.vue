<template>
  <div class="theme-preview">
    <div class="theme-preview-header">
      <h3 v-if="!isEditing">{{ props.theme.name }}</h3>
      <input v-else type="text" v-model="theme.name" />
      <button @click="editTheme">
        {{ isEditing ? "סיים עריכה" : "ערוך" }}
      </button>
    </div>
    <p v-if="!isEditing">{{ props.theme.description }}</p>
    <textarea v-else v-model="theme.description" />
  </div>
</template>
<script setup lang="ts">
import { defineProps, ref, toRaw } from "vue";
import { Book, Theme } from "../../../../../shared/types/books";
import { useRoute } from "vue-router";
import { useGetBook } from "../../../composables/useGetBook";
import { useUpdateBook } from "../../../composables/useUpdateBook";

const route = useRoute();
const bookId = route.query.id as string;
const { book } = useGetBook(bookId);
const updateBook = useUpdateBook(bookId);
const props = defineProps<{ theme: Theme }>();
const theme = ref({ ...props.theme });
const isEditing = ref(false);


function editTheme() {
  isEditing.value = !isEditing.value;
  if (isEditing.value) return;
  const newBook = structuredClone(toRaw(book.value)) as Book;
  const themeIndex = newBook.themes.findIndex(
    (t) => t.sortOrder === theme.value.sortOrder
  );
  if (themeIndex === -1) return;
  newBook.themes[themeIndex] = toRaw(theme.value);
  updateBook(newBook);
}
</script>
<style lang="scss" scoped>
.theme-preview {
  display: flex;
  flex-direction: column;
  gap: 0.5em;
  direction: rtl;
  border: 1px solid #000;
  padding: 0.5em;
  border-radius: 5px;
  min-width: 250px;
  width: max-content;

  .theme-preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5em;
    direction: rtl;

    h3 {
      margin: 0;
    }

    button {
      padding: 0.25em 0.5em;
      border-radius: 5px;
      cursor: pointer;
    }
  }
}
</style>
