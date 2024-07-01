<template>
  <button class="add-btn" @click="handleAddBtnClick">הוסף ספר</button>
  <Modal :isVisible="isAdding" @update:isVisible="isAdding = $event">
    <form class="form" @submit.prevent="handleFormSubmit">
      <input type="text" placeholder="שם הספר" v-model="bookTitle" />
      <button type="submit">הוסף</button>
    </form>
  </Modal>
</template>
<script setup lang="ts">
import { ref } from "vue";
import bookApiService from "../../../services/bookApiService.ts";
import { Book } from "../../../../../shared/types/books";
import Modal from "../../../components/Modal.vue";

const isAdding = ref(false);
const bookTitle = ref("");

function handleAddBtnClick() {
  isAdding.value = true;
}

async function handleFormSubmit() {
  if (!bookTitle.value) return;
  const addedBook = {
    name: bookTitle.value,
  } as Book;
  await bookApiService.add(addedBook);
  isAdding.value = false;
  bookTitle.value = "";
}
</script>
<style lang="scss" scoped>
.add-btn {
  padding: 1em 2em;
  font-size: 1.5em;
  background-color: var(--color-theme);
  color: var(--color-text);
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.add-btn:hover {
  background-color: var(--color-theme-dark);
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
    font-size: 1em;
    border: none;
    border-radius: 5px;
    direction: ltr;
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
