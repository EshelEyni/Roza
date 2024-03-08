<template>
  <div class="character-preview" @click="handlePreviewClick">
    <h2>{{ props.character.name }}</h2>
    <p>{{ props.character.description }}</p>
  </div>
  <Modal :isVisible="isEditing" @update:isVisible="isEditing = $event">
    <form class="form" @submit.prevent="handleFormSubmit">
      <input
        type="text"
        placeholder="שם הדמות"
        v-model="props.character.name"
      />
      <textarea
        placeholder="תיאור הדמות"
        v-model="props.character.description"
      />
      <button type="submit">הוסף</button>
    </form>
  </Modal>
</template>
<script setup lang="ts">
import { ref, defineProps } from "vue";
import { Character } from "../../../../../shared/types/books";
import Modal from "../../../components/Modal.vue";

const props = defineProps<{ character: Character }>();
const isEditing = ref(false);

function handlePreviewClick() {
  isEditing.value = true;
}

function handleFormSubmit() {
  console.log("handleFormSubmit");
}
</script>
<style lang="scss" scoped>
.character-preview {
  width: 100%;
  border: 1px solid #ccc;
  padding: 1em;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  direction: rtl;
  text-align: right;
  cursor: pointer;

  h2 {
    font-size: 1.5rem;
    margin: 0;
  }

  p {
    margin: 0;
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
