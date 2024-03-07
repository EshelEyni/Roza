<template>
  <div class="chapter-list-container">
    <h1>פרקים</h1>
    <button @click="addChapter" class="btn-add">הוסף פרק</button>
    <ul class="chapter-list">
      <li
        v-for="(chapter, index) in book.chapters"
        :key="index"
        class="chapter-list-item"
      >
        <ChapterPreview :chapter="chapter" />
      </li>
    </ul>
  </div>
</template>
<script setup lang="ts">
import { defineProps } from "vue";
import { Book, Chapter } from "../../../../../shared/types/books";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import bookApiService from "../../../services/bookApiService";
import ChapterPreview from "../components/ChapterPreview.vue";
import cloneDeep from "lodash/cloneDeep";

const props = defineProps<{ book: Book }>();
const queryClient = useQueryClient();
const mutation = useMutation({
  mutationFn: (newBook: Book) => bookApiService.update(newBook),
  onSuccess: () => {
    const { book } = props;
    queryClient.invalidateQueries({
      queryKey: ["book", book._id],
    });
  },
});

async function addChapter() {
  const { book } = props;
  if (!book) return;
  const newBook = cloneDeep(book) as Book;
  const chapterCount = book.chapters.length || 0;
  const newChapter: Chapter = {
    name: "פרק חדש",
    description: "תיאור חדש",
    text: "טקסט חדש",
    createdAt: new Date(),
    sortOrder: chapterCount + 1,
    bookId: book._id,
  };
  newBook.chapters.push(newChapter);
  mutation.mutate(newBook);
}
</script>
<style lang="scss" scoped>
.chapter-list-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5em;
  direction: ltr;

  .chapter-list {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    direction: rtl;
    list-style: none;
    gap: 0.5em;

    .chapter-list-item {
      width: 100%;
      flex: 1 1 250px;
    }
  }

  .btn-add {
    padding: 0.5em 1em;
    font-weight: 600;
    font-size: 1.2rem;
    border-radius: 5px;
  }
}
</style>
