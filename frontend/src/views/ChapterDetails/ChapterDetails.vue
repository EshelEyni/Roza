<template>
  <div class="chapter-details" v-if="chapter">
    <h2>{{ chapter.name }}</h2>
    <p>Created at: {{ formattedCreatedAt }}</p>
    <p>Sort order: {{ chapter.sortOrder }}</p>
    <div class="description">
      <h3>Description:</h3>
      <p>{{ chapter.description }}</p>
    </div>
    <div class="text">
      <h3>Text:</h3>
      <p>{{ chapter.text }}</p>
    </div>
  </div>
  <div v-else>Chapter details not available.</div>
</template>

<script setup lang="ts">
import { computed, ref, defineProps, onMounted } from "vue";
import { Book, Chapter } from "../../../../shared/types/books";
import bookApiService from "../../services/bookApiService";
import { useRoute } from "vue-router";
const route = useRoute();
const chapter = ref<Chapter | null>(null);

async function GetBook() {
  const bookId = route.query.bookId;
  const response = await bookApiService.getById(bookId as string);
  return response.data as Book;
}

async function getChapter() {
  const book = await GetBook();
  const chapterId = route.query.chapterId;
  chapter.value =
    book.chapters.find(
      (chapter: Chapter) => chapter.sortOrder === Number(chapterId)
    ) || null;
}

// Define props received from parent
const props = defineProps<{
  chapter: Chapter;
}>();

// Computed property for formatted date
const formattedCreatedAt = computed(() => {
  if (props.chapter && props.chapter.createdAt) {
    // Assuming createdAt is in a format recognized by Date constructor
    return new Date(props.chapter.createdAt).toLocaleDateString();
  }
  return "Unknown";
});

onMounted(getChapter);
</script>

<style scoped>
.chapter-details {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding: 1em;
  border: 1px solid #ccc;
  margin-top: 1em;
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
