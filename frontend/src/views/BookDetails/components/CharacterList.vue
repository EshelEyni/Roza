<template>
  <div class="character-list-container" v-if="book" :key="book._id">
    <h1>דמויות</h1>
    <button @click="handleAddBtnClick" class="btn-add">הוסף דמות</button>
    <ul class="character-list">
      <li
        v-for="character in book.characters"
        :key="character.sortOrder"
        class="character-list-item"
      >
        <CharacterPreview :character="character" />
      </li>
    </ul>

    <Modal :isVisible="isAdding" @update:isVisible="isAdding = $event">
      <form class="form" @submit.prevent="handleFormSubmit">
        <input type="text" placeholder="שם הדמות" v-model="newCharacter.name" />
        <textarea
          placeholder="תיאור הדמות"
          v-model="newCharacter.description"
        />
        <button type="submit">הוסף</button>
      </form>
    </Modal>
  </div>
</template>
<script setup lang="ts">
import { ref, toRaw } from "vue";
import { Book, Character } from "../../../../../shared/types/books";
import CharacterPreview from "./CharacterPreview.vue";
import Modal from "../../../components/Modal.vue";
import { useRoute } from "vue-router";
import { useUpdateBook } from "../../../composables/useUpdateBook";
import { useGetBook } from "../../../composables/useGetBook";

const route = useRoute();
const bookId = route.query.id as string;
const { book } = useGetBook(bookId);

const updateBook = useUpdateBook(bookId);

const isAdding = ref(false);
const newCharacter = ref({ name: "", description: "" } as Character);

function handleAddBtnClick() {
  isAdding.value = true;
}

function handleFormSubmit() {
  if (!book.value) return;
  if (!newCharacter.value.name) return;
  isAdding.value = false;
  const newBook = structuredClone(toRaw(book.value)) as Book;
  const sortOrder = newBook.characters.length + 1;
  newCharacter.value.bookId = newBook._id;
  newCharacter.value.sortOrder = sortOrder;
  newBook.characters = [...newBook.characters, newCharacter.value];
  updateBook(newBook);
  newCharacter.value = { ...newCharacter.value, name: "", description: "" };
}
</script>
<style lang="scss" scoped>
.character-list-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5em;
  direction: ltr;

  .character-list {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    direction: rtl;
    list-style: none;
    gap: 0.5em;

    .character-list-item {
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
.form {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1em;
  width: 100%;
  max-width: 450px;
  direction: rtl;
  background-color: var(--color-theme);
  padding: 2em;
  border-radius: 5px;
  z-index: 200;

  input {
    padding: 0.5em;
    font-size: 1.4em;
    border: none;
    border-radius: 5px;
    direction: rtl;
    text-align: right;
    width: 100%;
    max-width: 250px;
  }

  textarea {
    padding: 0.5em;
    font-size: 1.2em;
    border: none;
    border-radius: 5px;
    direction: rtl;
    text-align: right;
    width: 100%;
    max-width: 250px;
  }

  button {
    padding: 0.5em 1em;
    font-size: 1em;
    border: 0.8px solid #000;
    border-radius: 25px;
  }
}
</style>
