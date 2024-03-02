<template>
  <div class="chapter-preview" @click="handlePreviewClick">
    <h1>
      {{ chapter.name }}
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
  width: 300px;
  border: 1px solid #ccc;
  padding: 20px;
  margin: 20px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  direction: ltr;
  text-align: left;
}
</style>
