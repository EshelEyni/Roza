<template>
  <section class="page">
    <h1 class="title">homepage</h1>
    <ReviewList :books="reviews" />
  </section>
</template>
<script setup lang="ts">
import { onMounted, ref } from "vue";
import bookReviewApiService from "../../services/bookReviewApiService";
import { BookReview } from "../../../../shared/types/books";
import ReviewList from "./ReviewList.vue";

const reviews = ref<BookReview[]>([]);

async function getBooks() {
  const response = await bookReviewApiService.get();
  reviews.value = response.data;
}

onMounted(getBooks);
</script>
<style lang="scss" scoped>
.page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2em;

  .title {
    font-size: 4em;
    text-transform: capitalize;
  }
}
</style>
