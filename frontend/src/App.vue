<script setup lang="ts">
import SideBar from "./components/SideBar.vue";
</script>

<template>
  <main class="app-content">
    <RouterView />
  </main>
  <SideBar />
</template>

<style scoped lang="scss">
.app-content {
  font-family: Arial, sans-serif;
  padding: 20px;
  width: calc(100% - 25rem);
  min-height: 100vh;
  margin-left: 25rem;
  background-color: var(--color-theme);
}
</style>
