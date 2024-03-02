<template>
  <aside class="side-bar">
    <div>Books</div>
  </aside>
</template>
<script setup lang="ts"></script>
<style lang="scss" scoped>
.side-bar {
  position: fixed;
  top: 0;
  left: 0;
  width: 25rem;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1em 0;
  gap: 2em;
  background-color: var(--color-theme);
  background-image: url("/android-chrome-192x192.png");
  background-repeat: no-repeat;
  background-size: 75px;
  border-right: 1px solid #000;
}
</style>
