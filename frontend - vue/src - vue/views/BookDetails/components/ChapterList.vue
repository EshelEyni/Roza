<template>
  <div class="chapter-list-container" v-if="book">
    <h1>פרקים</h1>
    <button @click="addChapter" class="btn-add">הוסף פרק</button>
    <ul class="chapter-list">
      <li
        v-for="(chapter, index) in book.chapters"
        :key="index"
        class="chapter-list-item"
      >
        <ChapterPreview :chapter="chapter" />
      </li>
    </ul>
  </div>
</template>
<script setup lang="ts">
import { toRaw } from "vue";
import { Book, Chapter } from "../../../../../shared/types/books";
import ChapterPreview from "../components/ChapterPreview.vue";
import { useRoute } from "vue-router";
import { useUpdateBook } from "../../../composables/useUpdateBook";
import { useGetBook } from "../../../composables/useGetBook";

const route = useRoute();
const bookId = route.query.id as string;
const { book } = useGetBook(bookId);
const updateBook = useUpdateBook(bookId);

async function addChapter() {
  if (!book.value) return;
  const newBook = structuredClone(toRaw(book.value)) as Book;
  const chapterCount = book.value.chapters.length + 1;
  const newChapter: Chapter = {
    name: "פרק חדש",
    description: "תיאור חדש",
    text: "טקסט חדש",
    createdAt: new Date(),
    sortOrder: chapterCount,
    bookId: book.value._id,
  };
  newBook.chapters = [...newBook.chapters, newChapter];
  updateBook(newBook);
}
</script>
<style lang="scss" scoped>
.chapter-list-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5em;
  direction: ltr;

  .chapter-list {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    direction: rtl;
    list-style: none;
    gap: 0.5em;

    .chapter-list-item {
      width: 100%;
      flex: 1 1 250px;
    }
  }

  .btn-add {
    padding: 0.5em 1em;
    font-weight: 600;
    font-size: 1.2rem;
    border-radius: 5px;
  }
}
</style>
