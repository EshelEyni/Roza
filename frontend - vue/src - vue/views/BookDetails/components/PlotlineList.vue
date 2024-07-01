<template>
  <div class="plotline-list-container" v-if="book">
    <h2>קווי עלילה</h2>
    <button @click="addPlotline" class="btn-add">הוסף קו עלילה חדש</button>
    <ul class="plotline-list">
      <li
        v-for="(plotline, index) in book.plotlines"
        :key="index"
        class="plotline-list-item"
      >
        <PlotlinePreview :plotline="plotline" />
      </li>
    </ul>
  </div>
</template>
<script setup lang="ts">
import { toRaw } from "vue";
import { useRoute } from "vue-router";
import { useGetBook } from "../../../composables/useGetBook";
import { useUpdateBook } from "../../../composables/useUpdateBook";
import { Book, Plotline } from "../../../../../shared/types/books";
import PlotlinePreview from "./PlotlinePreview.vue";

const route = useRoute();
const bookId = route.query.id as string;
const { book } = useGetBook(bookId);
const updateBook = useUpdateBook(bookId);

async function addPlotline() {
  if (!book.value) return;
  const newBook = structuredClone(toRaw(book.value)) as Book;
  const plotlineCount = book.value.plotlines.length + 1;
  const newPlotline: Plotline = {
    name: "קו עלילה חדש",
    description: "תיאור חדש",
    sortOrder: plotlineCount,
    bookId: book.value._id,
  };
  newBook.plotlines = [...newBook.plotlines, newPlotline];
  updateBook(newBook);
}
</script>
<style lang="scss" scoped>
.plotline-list-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5em;
  direction: rtl;

  .plotline-list {
    display: flex;
    flex-direction: column;
    direction: rtl;
    list-style: none;
    gap: 0.5em;
    width: max-content;
    max-width: 100%;
    .plotline-list-item {
      display: flex;
      flex-direction: column;
      gap: 0.5em;
    }
  }
  .btn-add {
    max-width: 150px;
    padding: 0.5em 1em;
    font-weight: 600;
    font-size: 1.2rem;
    border-radius: 5px;
    margin-bottom: 1em;
  }
}
</style>
