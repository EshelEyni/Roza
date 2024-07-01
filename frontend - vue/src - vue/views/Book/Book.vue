<template>
  <section class="page">
    <h1>ספרים</h1>
    <BookEdit />
    <BookList :books="books" />
  </section>
</template>
<script setup lang="ts">
import { onMounted, ref } from "vue";
import BookEdit from "./components/BookEdit.vue";
import bookApiService from "../../services/bookApiService";
import { Book } from "../../../../shared/types/books";
import BookList from "./components/BookList.vue";

const books = ref<Book[]>([]);

async function getBooks() {
  const response = await bookApiService.get();
  console.log(response.data);
  books.value = response.data;
}

onMounted(getBooks);
</script>
<style lang="scss" scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 2em;
  padding: 2em;
  width: 100%;
  height: 100%;
  background-color: var(--color-theme);

  h1 {
    align-self: center;
  }
}
</style>
