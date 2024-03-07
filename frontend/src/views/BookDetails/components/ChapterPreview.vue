<template>
  <div class="chapter-preview" @click="handlePreviewClick">
    <h1 class="chapter-title">
      <span> {{ chapter.sortOrder }}. </span>
      <span> {{ chapter.name }} </span>
    </h1>
  </div>
</template>
<script setup lang="ts">
import { defineProps } from "vue";
import { Chapter } from "../../../../../shared/types/books";
import { useRouter } from "vue-router";
const router = useRouter();
const props = defineProps<{ chapter: Chapter }>();

function handlePreviewClick() {
  const { chapter } = props;
  router.push({
    name: "chapter",
    query: { bookId: chapter.bookId, chapterId: chapter.sortOrder },
  });
}
</script>
<style lang="scss" scoped>
.chapter-preview {
  width: 100%;
  border: 1px solid #ccc;
  padding: 1em;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  direction: rtl;
  text-align: right;
  
  .chapter-title {
    font-size: 1.5rem;
    margin: 0;
  }
}
</style>
