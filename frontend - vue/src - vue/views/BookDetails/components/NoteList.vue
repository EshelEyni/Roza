<template>
  <div class="note-list-container" v-if="book">
    <h2>הערות</h2>
    <button @click="addNote" class="btn-add">הוסף הערה</button>
    <ul class="note-list">
      <li
        v-for="(note, index) in book.notes"
        :key="index"
        class="note-list-item"
      >
        <NotePreview :note="note" />
      </li>
    </ul>
  </div>
</template>
<script setup lang="ts">
import { toRaw } from "vue";
import { useRoute } from "vue-router";
import { useGetBook } from "../../../composables/useGetBook";
import { useUpdateBook } from "../../../composables/useUpdateBook";
import { Book, Note } from "../../../../../shared/types/books";
import NotePreview from "./NotePreview.vue";

const route = useRoute();
const bookId = route.query.id as string;
const { book } = useGetBook(bookId);
const updateBook = useUpdateBook(bookId);

async function addNote() {
  if (!book.value) return;
  const newBook = structuredClone(toRaw(book.value)) as Book;
  const noteCount = book.value.notes.length + 1;
  const newNote: Note = {
    text: "הערה חדשה",
    sortOrder: noteCount,
    bookId: book.value._id,
  };
  newBook.notes = [...newBook.notes, newNote];
  updateBook(newBook);
}
</script>
<style lang="scss" scoped>
.note-list-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5em;
  direction: rtl;

  .note-list {
    width: 100%;
    display: flex;
    flex-direction: column;
    direction: rtl;
    list-style: none;
    gap: 0.5em;

    .note-list-item {
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
