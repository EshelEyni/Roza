<template>
  <teleport to="body">
    <div v-if="isVisible" class="modal">
      <div class="main-screen" @click="closeModal" />
      <slot></slot>
    </div>
  </teleport>
</template>

<script setup lang="ts">
defineProps({ isVisible: Boolean });
const emit = defineEmits(["update:isVisible"]);

function closeModal() {
  emit("update:isVisible", false);
}
</script>

<style scoped>
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
}

.main-screen {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 100;
  cursor: pointer;
}
</style>
