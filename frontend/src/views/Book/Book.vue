<template>
  <section class="page">
    <h1>Book</h1>
  </section>
</template>
<script setup lang="ts">
import { onMounted } from "vue";
import bookReviewApiService from "../../services/bookReviewApiService";

async function getBooks() {
  const response = await bookReviewApiService.get();
  console.log(response.data);
}

onMounted(getBooks);
</script>
<style lang="scss" scoped>
.page {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2em;
  padding: 2em;
  width: 100%;
  height: 100%;
  background-color: var(--color-theme);
}
</style>
