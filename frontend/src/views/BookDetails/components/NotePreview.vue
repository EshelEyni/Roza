<template>
  <div class="note-preview">
    <div class="note-preview-header">
      <h3>
        הערה מספר
        <span>
          {{ note.sortOrder }}
        </span>
      </h3>
      <button @click="editNote">
        {{ isEditing ? "שמור" : "ערוך" }}
      </button>
    </div>
    <div v-if="isEditing">
      <textarea v-model="note.text" />
    </div>
    <p v-else>{{ note.text }}</p>
  </div>
</template>
<script setup lang="ts">
import { defineProps, ref, toRaw } from "vue";
import { Book, Note } from "../../../../../shared/types/books";
import { useRoute } from "vue-router";
import { useGetBook } from "../../../composables/useGetBook";
import { useUpdateBook } from "../../../composables/useUpdateBook";

const route = useRoute();
const bookId = route.query.id as string;
const { book } = useGetBook(bookId);
const updateBook = useUpdateBook(bookId);
const props = defineProps<{ note: Note }>();
const note = ref({ ...props.note });
const isEditing = ref(false);

function editNote() {
  isEditing.value = !isEditing.value;
  if (isEditing.value) return;
  const newBook = structuredClone(toRaw(book.value)) as Book;
  const noteIndex = newBook.notes.findIndex(
    (n) => n.sortOrder === note.value.sortOrder
  );
  if (noteIndex === -1) return;
  newBook.notes[noteIndex] = toRaw(note.value);
  updateBook(newBook);
}
</script>
<style lang="scss" scoped>
.note-preview {
  display: flex;
  flex-direction: column;
  gap: 0.5em;
  direction: rtl;
  border: 1px solid #000;
  padding: 0.5em;
  border-radius: 5px;
  min-width: 250px;
  width: max-content;

  .note-preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5em;
    direction: rtl;

    h3 {
      margin: 0;
    }

    button {
      padding: 0.25em 0.5em;
      border-radius: 5px;
      cursor: pointer;
    }
  }
}
</style>
