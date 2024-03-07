<template>
  <div class="filter">
    <button
      v-for="value in filterValues"
      :key="value.value"
      @click="emit('filterBy', value.value)"
      :class="{ active: filterBy === value.value }"
    >
      {{ value.label }}
    </button>
  </div>
</template>
<script setup lang="ts">
import { defineEmits, defineProps } from "vue";
const filterValues = [
  {
    value: "chapters",
    label: "פרקים",
  },
  {
    value: "characters",
    label: "דמויות",
  },
  {
    value: "themes",
    label: "תמות",
  },
  {
    value: "plotlines",
    label: "קווי עלילה",
  },
  {
    value: "notes",
    label: "הערות",
  },
];
defineProps({ filterBy: String });
const emit = defineEmits(["filterBy"]);
</script>
<style lang="scss" scoped>
.filter {
  display: flex;
  gap: 0.5em;
  margin-bottom: 1em;
  direction: rtl;

  button {
    padding: 0.5em 1em;
    border: none;
    border-radius: 0.5em;
    background-color: #f0f0f0;
    cursor: pointer;

    &.active {
      background-color: #e0e0e0;
      border: 1px solid #000;
    }
  }
}
</style>
