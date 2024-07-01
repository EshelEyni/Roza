<template>
  <div class="theme-list-container" v-if="book">
    <h2>נושאים</h2>
    <button class="btn-add" @click="addTheme">הוסף נושא חדש</button>
    <ul class="theme-list">
      <li
        v-for="(theme, index) in book.themes"
        :key="index"
        class="theme-list-item"
      >
        <ThemePreview :theme="theme" />
      </li>
    </ul>
  </div>
</template>
<script setup lang="ts">
import { toRaw } from "vue";
import { useRoute } from "vue-router";
import { useGetBook } from "../../../composables/useGetBook";
import { useUpdateBook } from "../../../composables/useUpdateBook";
import { Book, Theme } from "../../../../../shared/types/books";
import ThemePreview from "./ThemePreview.vue";

const route = useRoute();
const bookId = route.query.id as string;
const { book } = useGetBook(bookId);
const updateBook = useUpdateBook(bookId);

async function addTheme() {
  if (!book.value) return;
  const newBook = structuredClone(toRaw(book.value)) as Book;
  const themeCount = book.value.themes.length + 1;
  const newTheme: Theme = {
    name: "נושא חדש",
    description: "תיאור חדש",
    sortOrder: themeCount + 1,
    bookId: book.value._id,
  };
  newBook.themes = [...newBook.themes, newTheme];
  updateBook(newBook);
}
</script>
<style lang="scss" scoped>
.theme-list-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5em;
  direction: rtl;

  .theme-list {
    width: 100%;
    display: flex;
    flex-direction: column;
    direction: rtl;
    list-style: none;
    gap: 0.5em;
    min-width: 250px;
    width: max-content;
    max-width: 100%;

    .theme-list-item {
      display: flex;
      flex-direction: column;
      gap: 0.5em;
    }
  }
  .btn-add {
    max-width: 150px;
    padding: 0.5em 1em;
    font-weight: 600;
    font-size: 1.2rem;
    border-radius: 5px;
    margin-bottom: 1em;
  }
}
</style>
