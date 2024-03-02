<template>
  <div v-if="book">{{ book.name }}</div>
  <div v-else>No book found</div>
</template>
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { Book } from "../../../../shared/types/books";
import { useRoute } from "vue-router";
import bookApiService from "../../services/bookApiService";

const book = ref<Book | null>(null);
const route = useRoute();

async function getBookDetails() {
  const bookId = route.query.id;
  const response = await bookApiService.getById(bookId as string);
  book.value = await response.data;
}

onMounted(getBookDetails);
</script>
<style lang="scss" scoped></style>
