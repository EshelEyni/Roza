<template>
  <div class="character-list-container">
    <h1>דמויות</h1>
    <button @click="addCharacter" class="btn-add">הוסף דמות</button>
    <ul class="character-list">
      <li
        v-for="(character, index) in book.characters"
        :key="index"
        class="character-list-item"
      >
        <!-- <CharacterPreview :character="character" /> -->
        <div class="character-preview">
          <h2>{{ character.name }}</h2>
          <p>{{ character.description }}</p>
        </div>
      </li>
    </ul>
  </div>
</template>
<script setup lang="ts">
import { Book } from "../../../../../shared/types/books";
import bookApiService from "../../../services/bookApiService";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import cloneDeep from "lodash/cloneDeep";

const props = defineProps<{ book: Book }>();

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

function addCharacter() {
  const { book } = props;
  if (!book) return;
  const newBook = cloneDeep(book) as Book;
  console.log(newBook.characters.length);
  const newCharacter = {
    name: "דמות חדשה",
    description: "תיאור חדש",
    bookId: book._id,
  };
  newBook.characters.push(newCharacter);
  mutation.mutate(newBook);
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
}
</style>
