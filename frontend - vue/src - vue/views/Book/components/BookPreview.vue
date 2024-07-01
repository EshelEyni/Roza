<template>
  <div class="book-preview" @click="handlePreviewClick">
    <h2 class="book-title">{{ book.name }}</h2>
  </div>
</template>

<script setup lang="ts">
import { defineProps } from "vue";
import { Book } from "../../../../../shared/types/books";
import { useRouter } from "vue-router";
const props = defineProps<{ book: Book }>();
const router = useRouter();

function handlePreviewClick() {
  const { book } = props;
  router.push({ name: "books", query: { id: book.id } });
}
</script>

<style scoped>
.book-preview {
  width: 300px;
  border: 1px solid #ccc;
  padding: 20px;
  margin: 20px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  direction: ltr;
  text-align: left;
  cursor: pointer;
}

.book-title {
  font-size: 20px;
  margin: 10px 0;
  text-align: center;
}
</style>
