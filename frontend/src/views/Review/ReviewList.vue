<template>
  <div class="book-review-num">
    number of books:
    {{ books.length }}
  </div>
  <ul class="book-list">
    <li v-for="book in books" :key="book._id">
      <BookReviewPreview :book="book" />
    </li>
  </ul>
</template>
<script setup lang="ts">
import { BookReview } from "../../../../shared/types/books";
import BookReviewPreview from "./ReviewPreview.vue";
defineProps<{ books: BookReview[] }>();
</script>
<style scoped lang="scss">
.book-review-num {
  font-size: 2em;
  text-transform: capitalize;
  color: #333;
  margin-bottom: 1em;
}

.book-list {
  direction: rtl;
  list-style: none;
  padding: 0 3em;
  display: flex;
  flex-wrap: wrap;
  gap: 1em;
}
</style>
