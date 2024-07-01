<template>
  <div class="plotline-preview">
    <div class="plotline-preview-header">
      <h3 v-if="!isEditing">{{ plotline.name }}</h3>
      <input v-else type="text" v-model="plotline.name" />
      <button @click="editPlotline">
        {{ isEditing ? "שמור" : "ערוך" }}
      </button>
    </div>
    <p
      class="plotline-preview-description"
      v-if="!isEditing"
      v-html="plotlineDescriptionHtml"
    ></p>
    <textarea
      class="plotline-preview-description-text-area"
      v-else
      v-model="plotline.description"
    />
  </div>
</template>
<script setup lang="ts">
import { defineProps, ref, toRaw, computed } from "vue";
import { Book, Plotline } from "../../../../../shared/types/books";
import { useRoute } from "vue-router";
import { useGetBook } from "../../../composables/useGetBook";
import { useUpdateBook } from "../../../composables/useUpdateBook";

const route = useRoute();
const bookId = route.query.id as string;
const { book } = useGetBook(bookId);
const updateBook = useUpdateBook(bookId);
const props = defineProps<{ plotline: Plotline }>();
const plotline = ref({ ...props.plotline });
const isEditing = ref(false);

const plotlineDescriptionHtml = computed(() => {
  return props.plotline.description.replace(/\n/g, "<br>");
});

function editPlotline() {
  isEditing.value = !isEditing.value;
  if (isEditing.value) return;
  const newBook = structuredClone(toRaw(book.value)) as Book;
  const plotlineIndex = newBook.plotlines.findIndex(
    (p) => p.sortOrder === plotline.value.sortOrder
  );
  if (plotlineIndex === -1) return;
  newBook.plotlines[plotlineIndex] = toRaw(plotline.value);
  updateBook(newBook);
}
</script>
<style lang="scss" scoped>
.plotline-preview {
  display: flex;
  flex-direction: column;
  gap: 0.5em;
  direction: rtl;
  border: 1px solid #000;
  padding: 0.5em;
  border-radius: 5px;

  .plotline-preview-header {
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

  .plotline-preview-description {
    margin: 0;
  }

  .plotline-preview-description-text-area {
    padding: 0.25em;
  }
}
</style>
