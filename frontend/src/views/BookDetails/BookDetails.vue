<template>
  <div v-if="book" class="book-details">
    <h1 class="book-title">
      {{ book.name }}
    </h1>
    <div>
      <span>
        {{ book.chapters.length }}
      </span>
      <span> :פרקים </span>
    </div>
    <Filter :book="book" :filterBy="filterBy" @filterBy="filterBy = $event" />
    <ChapterList v-if="filterBy === 'chapters'" />
    <CharacterList v-else-if="filterBy === 'characters'" />
  </div>
  <div v-else-if="isError">
    <p>אופס, משהו השתבש</p>
  </div>
  <div v-else-if="isLoading">
    <BookLoader />
  </div>
</template>
<script setup lang="ts">
import { ref, toRaw } from "vue";
import { Book, BookFilterBy } from "../../../../shared/types/books";
import { useRoute } from "vue-router";
import ChapterList from "./components/ChapterList.vue";
import CharacterList from "./components/CharacterList.vue";
import Filter from "./components/Filter.vue";
import BookLoader from "../../components/BookLoader.vue";
import { useGetBook } from "../../composables/useGetBook";

const route = useRoute();
const bookId = route.query.id as string;
const filterBy = ref("chapters" as BookFilterBy);
const { book, isError, isLoading } = useGetBook(
  bookId,
  (book: Book) => (filterBy.value = book.filterBy)
);
console.log(toRaw(book.value));
</script>
<style lang="scss" scoped>
.book-details {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5em;
  direction: ltr;

  .book-title {
    align-self: center;
    font-size: 3rem;
  }
}
</style>
