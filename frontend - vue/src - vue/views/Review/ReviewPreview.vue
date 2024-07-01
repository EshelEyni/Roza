<template>
  <div class="book-container">
    <h1 class="book-name">
      <span>{{ book.sortOrder }}.</span>
      {{ book.name }}
    </h1>
    <div class="book-review">{{ text }}</div>
    <button @click="onShowMore()">show more</button>
    <div class="book-date">{{ book.createdAt }}</div>
    <!-- <div>
      <button @click="markAsFavorite()">mark as favorite</button>
    </div> -->
  </div>
</template>

<script setup lang="ts">
import { defineProps, ref } from "vue";
import { BookReview } from "../../../../shared/types/books";
import bookReviewApiService from "../../services/bookReviewApiService";
const props = defineProps<{ book: BookReview }>();
const { book } = props;
const text = ref<string>(trimReview(book.reviews[0].text));

function onShowMore() {
  text.value = book.reviews[0].text;
}

function trimReview(review: string) {
  return review.length > 400 ? review.slice(0, 400) + "..." : review;
}

async function markAsFavorite() {
  const { book } = props;
  const reviewToMark = { ...book, isFavorite: true };
  await bookReviewApiService.update(reviewToMark);
  console.log("marked as favorite");
}
</script>

<style scoped>
.book-container {
  direction: rtl;
  max-width: 320px;
  min-height: 30rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 1em;
  border: 1px solid #ccc;
  border-radius: 5px;
}

.book-name {
  font-size: 2em;
  text-transform: capitalize;
  text-align: center;
  margin-bottom: 1em;
}

.book-review {
  text-align: right;
  font-size: 1.5em;
  margin-bottom: 1em;
  overflow: hidden;
}

.book-date {
  font-size: 1.2em;
  text-align: center;
  margin-bottom: 1em;
}
</style>
