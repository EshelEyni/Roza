<template>
  <button class="add-btn" @click="handleAddBtnClick">Add Book</button>
  <form v-if="isAdding" class="form" @submit.prevent="handleFormSubmit">
    <input type="text" placeholder="שם הספר" v-model="bookTitle" />
    <button type="submit">Add</button>
  </form>
</template>
<script setup lang="ts">
import { ref } from "vue";
import bookApiService from "../../../services/bookApiService.ts";
import { Book } from "../../../../../shared/types/books";
const isAdding = ref(false);
const bookTitle = ref("");

function handleAddBtnClick() {
  isAdding.value = true;
}

async function handleFormSubmit() {
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
  gap: 1em;
  width: 100%;
  max-width: 300px;
  direction: rtl;
}

.form input {
  padding: 0.5em;
  font-size: 1em;
  border: none;
  border-radius: 5px;
  direction: ltr;
  text-align: right;
}
</style>
