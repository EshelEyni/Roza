<template>
  <div class="theme-preview">
    <div class="theme-preview-header">
      <h3 v-if="!isEditing">{{ props.theme.name }}</h3>
      <input v-else type="text" v-model="theme.name" />
      <button @click="editTheme">
        {{ isEditing ? "סיים עריכה" : "ערוך" }}
      </button>
    </div>
    <p
      class="theme-preview-description"
      v-if="!isEditing"
      v-html="themeDescriptionHtml"
    ></p>
    <textarea
      class="theme-preview-description-text-area"
      v-else
      v-model="theme.description"
    />
  </div>
</template>
<script setup lang="ts">
import { defineProps, ref, toRaw, computed } from "vue";
import { Book, Theme } from "../../../../../shared/types/books";
import { useRoute } from "vue-router";
import { useGetBook } from "../../../composables/useGetBook";
import { useUpdateBook } from "../../../composables/useUpdateBook";

const route = useRoute();
const bookId = route.query.id as string;
const { book } = useGetBook(bookId);
const updateBook = useUpdateBook(bookId);
const props = defineProps<{ theme: Theme }>();
const theme = ref({ ...props.theme });
const isEditing = ref(false);

const themeDescriptionHtml = computed(() => {
  return props.theme.description.replace(/\n/g, "<br>");
});

function editTheme() {
  isEditing.value = !isEditing.value;
  if (isEditing.value) return;
  const newBook = structuredClone(toRaw(book.value)) as Book;
  const themeIndex = newBook.themes.findIndex(
    (t) => t.sortOrder === theme.value.sortOrder
  );
  if (themeIndex === -1) return;
  newBook.themes[themeIndex] = toRaw(theme.value);
  updateBook(newBook);
}
</script>
<style lang="scss" scoped>
.theme-preview {
  display: flex;
  flex-direction: column;
  gap: 0.5em;
  direction: rtl;
  border: 1px solid #000;
  padding: 0.5em;
  border-radius: 5px;

  .theme-preview-header {
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

  .theme-preview-description {
    margin: 0;
    word-wrap: break-word;
  }

  .theme-preview-description-text-area {
    padding: 0.5em;
    width: 100%;
    height: max-content;
  }
}
</style>
