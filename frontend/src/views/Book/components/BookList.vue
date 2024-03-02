<template>
  <div>
    <ul class="book-list">
      <li v-for="(book, index) in books" :key="index">
        <BookPreview :book="book" />
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { defineProps } from "vue";
import { Book } from "../../../../../shared/types/books";
import BookPreview from "./BookPreview.vue";
defineProps<{ books: Book[] }>();
</script>

<style scoped>
.book-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  direction: rtl;
  list-style: none;
  padding: 0 3em;
  gap: 1em;
  width: 100%;
}
</style>
