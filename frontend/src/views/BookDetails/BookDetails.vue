<template>
  <div v-if="book" class="book-details">
    <h1>
      {{ book.name }}
    </h1>
    <div>
      <span>
        {{ book.chapters.length }}
      </span>
      <span> :פרקים </span>
    </div>
    <button @click="addChapter" class="btn add-chapter">הוסף פרק</button>
    <ul class="chapter-list">
      <li v-for="(chapter, index) in book.chapters" :key="index">
        <ChapterPreview :chapter="chapter" />
      </li>
    </ul>
  </div>
  <div v-else>No book found</div>
</template>
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { Book, Chapter } from "../../../../shared/types/books";
import { useRoute } from "vue-router";
import bookApiService from "../../services/bookApiService";
import ChapterPreview from "./components/ChapterPreview.vue";

const book = ref<Book | null>(null);
const route = useRoute();

async function getBookDetails() {
  const bookId = route.query.id;
  const response = await bookApiService.getById(bookId as string);
  book.value = await response.data;
}

async function addChapter() {
  if (!book.value) return;
  const chapterCount = book.value.chapters.length || 0;
  const newChapter: Chapter = {
    name: "פרק חדש",
    description: "תיאור חדש",
    text: "טקסט חדש",
    createdAt: new Date(),
    sortOrder: chapterCount + 1,
    bookId: book.value._id,
  };
  book.value?.chapters.push(newChapter);
  await bookApiService.update(book.value as Book);
}

onMounted(getBookDetails);
</script>
<style lang="scss" scoped>
.book-details {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  direction: ltr;

  h1 {
    font-size: 2rem;
  }

  .chapter-list {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    direction: rtl;
    list-style: none;
    padding: 0 3em;
    gap: 0.5em;
    width: 100%;
  }
}
</style>
