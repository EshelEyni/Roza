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
    <ThemeList v-if="filterBy === 'themes'" />
    <ChapterList v-if="filterBy === 'chapters'" />
    <CharacterList v-else-if="filterBy === 'characters'" />
    <PlotlineList v-else-if="filterBy === 'plotlines'" />
    <NoteList v-else-if="filterBy === 'notes'" />
  </div>
  <div v-else-if="isError">
    <p>אופס, משהו השתבש</p>
  </div>
  <div v-else-if="isLoading">
    <BookLoader />
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { Book, BookFilterBy } from "../../../../shared/types/books";
import { useRoute } from "vue-router";
import ChapterList from "./components/ChapterList.vue";
import CharacterList from "./components/CharacterList.vue";
import Filter from "./components/Filter.vue";
import BookLoader from "../../components/BookLoader.vue";
import { useGetBook } from "../../composables/useGetBook";
import ThemeList from "./components/ThemeList.vue";
import PlotlineList from "./components/PlotlineList.vue";
import NoteList from "./components/NoteList.vue";

const route = useRoute();
const bookId = route.query.id as string;
const filterBy = ref("chapters" as BookFilterBy);
const { book, isError, isLoading } = useGetBook(
  bookId,
  (book: Book) => (filterBy.value = book.filterBy)
);
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

  .btn-add {
    padding: 0.5em 1em;
    font-weight: 600;
    font-size: 1.2rem;
    border-radius: 5px;
  }
}
</style>
