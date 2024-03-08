<template>
  <div class="chapter-details" v-if="book && chapter">
    <h1>{{ book.name }} - פרק {{ chapter.sortOrder }}</h1>
    <h2>{{ chapter.name }}</h2>
    <p>נוצר בתאריך: {{ formattedCreatedAt }}</p>

    <div class="description">
      <h3>תקציר:</h3>
      <p>{{ chapter.description }}</p>
    </div>
    <div class="text">
      <h3>טקסט:</h3>
      <p>{{ chapter.text }}</p>
    </div>
  </div>
  <div v-else-if="isError">
    <p>אופס, משהו השתבש</p>
  </div>
  <div v-else-if="isLoading">
    <BookLoader />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { Book, Chapter } from "../../../../shared/types/books";
import bookApiService from "../../services/bookApiService";
import { useRoute } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import BookLoader from "../../components/BookLoader.vue";

const route = useRoute();
const bookId = route.query.bookId as string;
const chapter = ref<Chapter | null>(null);

const {
  data: book,
  isError,
  isLoading,
} = useQuery({
  queryKey: ["book", bookId],
  queryFn: async () => {
    const res = await bookApiService.getById(bookId);
    const book = res.data as Book;
    const chapterId = route.query.chapterId;
    chapter.value =
      book.chapters.find(
        (chapter: Chapter) => chapter.sortOrder === Number(chapterId)
      ) || null;
    return book;
  },
  enabled: !!bookId,
});

const formattedCreatedAt = computed(() => {
  if (chapter.value && chapter.value.createdAt) {
    return new Date(chapter.value.createdAt).toLocaleDateString();
  }
  return "Unknown";
});
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

h2,
h3 {
  margin: 0.5em 0;
}

.description,
.text {
  margin-top: 1em;
}
</style>
