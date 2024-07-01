<script setup lang="ts">
import SideBar from "./components/SideBar.vue";
import { VueQueryDevtools } from "@tanstack/vue-query-devtools";
</script>

<template>
  <main class="app-content">
    <RouterView />
  </main>
  <SideBar />
  <VueQueryDevtools />
</template>

<style scoped lang="scss">
.app-content {
  font-family: Arial, sans-serif;
  padding: 20px;
  width: calc(100% - 25rem);
  min-height: 100vh;
  margin-right: 25rem;
  background-color: var(--color-theme);
}
</style>
