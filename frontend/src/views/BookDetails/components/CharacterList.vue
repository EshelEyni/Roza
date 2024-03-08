<template>
  <div class="character-list-container">
    <h1>דמויות</h1>
    <button @click="handleAddBtnClick" class="btn-add">הוסף דמות</button>
    <ul class="character-list">
      <li
        v-for="(character, index) in book.characters"
        :key="index"
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
import { ref } from "vue";
import { Book, Character } from "../../../../../shared/types/books";
import bookApiService from "../../../services/bookApiService";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { defineProps } from "vue";
import CharacterPreview from "./ChacterPreview.vue";
import cloneDeep from "lodash/cloneDeep";
import Modal from "../../../components/Modal.vue";

const props = defineProps<{ book: Book }>();
const isAdding = ref(false);
const newCharacter = ref({ name: "", description: "" } as Character);

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

function handleAddBtnClick() {
  isAdding.value = true;
}

function handleFormSubmit() {
  const { book } = props;
  if (!book) return;
  if (!newCharacter.value.name) return;
  isAdding.value = false;
  const newBook = cloneDeep(book) as Book;
  newCharacter.value.bookId = newBook._id;
  newBook.characters.push(newCharacter.value);
  mutation.mutate(newBook);
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
