<template>
  <div class="chapter-preview" @click="handlePreviewClick">
    <h1 class="chapter-title">
      <span> {{ chapter.sortOrder }}. </span>
      <span> {{ chapter.name }} </span>
    </h1>
    <p v-html="descriptionHtml"></p>
  </div>
</template>
<script setup lang="ts">
import { defineProps, computed } from "vue";
import { Chapter } from "../../../../../shared/types/books";
import { useRouter } from "vue-router";
const router = useRouter();
const props = defineProps<{ chapter: Chapter }>();

const descriptionHtml = computed(() => {
  return props.chapter.description.replace(/\n/g, "<br>");
});

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
  cursor: pointer;

  .chapter-title {
    font-size: 1.5rem;
    margin: 0;
  }
}
</style>
