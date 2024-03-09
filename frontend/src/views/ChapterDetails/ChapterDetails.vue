<template>
  <div class="chapter-details" v-if="book && chapter">
    <h1>{{ book.name }} - פרק {{ chapter.sortOrder }}</h1>
    <input
      class="chapter-name-input"
      type="text"
      placeholder="שם הפרק"
      v-model="chapter.name"
    />
    <p>נוצר בתאריך: {{ formattedCreatedAt }}</p>

    <div class="description">
      <h3>תקציר:</h3>
      <textarea class="description-textarea" v-model="chapter.description" />
    </div>
    <div class="text">
      <h3>טקסט:</h3>
      <textarea class="text-textarea" v-model="chapter.text" />
    </div>

    <button class="btn-save" @click="handleSaveChanges">שמור שינויים</button>
  </div>
  <div v-else-if="isError">
    <p>אופס, משהו השתבש</p>
  </div>
  <div v-else-if="isLoading">
    <BookLoader />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRaw } from "vue";
import { Book, Chapter } from "../../../../shared/types/books";
import { useRoute } from "vue-router";
import BookLoader from "../../components/BookLoader.vue";
import { useGetBook } from "../../composables/useGetBook";
import { useUpdateBook } from "../../composables/useUpdateBook";

const route = useRoute();
const bookId = route.query.bookId as string;
const chapter = ref<Chapter | null>(null);
const { book, isError, isLoading } = useGetBook(bookId, (book: Book) => {
  const chapterId = route.query.chapterId;
  chapter.value =
    book.chapters.find(
      (chapter: Chapter) => chapter.sortOrder === Number(chapterId)
    ) || null;
});
const updateBook = useUpdateBook(bookId);

const formattedCreatedAt = computed(() => {
  if (chapter.value && chapter.value.createdAt) {
    return new Date(chapter.value.createdAt).toLocaleDateString();
  }
  return "Unknown";
});

function handleSaveChanges() {
  if (!chapter || !chapter.value) return;
  const updatedChapter = toRaw(chapter.value) as Chapter;
  const newBook = structuredClone(toRaw(book.value)) as Book;
  newBook.chapters = newBook.chapters.map((c) =>
    c.sortOrder === updatedChapter.sortOrder ? updatedChapter : c
  );
  updateBook(newBook);
}
</script>

<style scoped>
.chapter-details {
  display: flex;
  flex-direction: column;
  padding: 1em;
  border: 1px solid #ccc;
  margin-top: 1em;
  direction: rtl;
}

.chapter-name-input {
  padding: 0.25em;
  margin-top: 1em;
  width: fit-content;
}

h2,
h3 {
  margin: 0.5em 0;
}

.description,
.text {
  margin-top: 1em;
}

.btn-save {
  padding: 0.5em 1em;
  margin-top: 1em;
  width: fit-content;
}

.description-textarea,
.text-textarea {
  padding: 0.25em;
}
</style>
