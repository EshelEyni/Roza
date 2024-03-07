<template>
  <aside class="side-bar">
    <div>ספרים</div>
  </aside>
</template>
<script setup lang="ts"></script>
<style lang="scss" scoped>
.side-bar {
  position: fixed;
  top: 0;
  right: 0;
  width: 25rem;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1em 0;
  gap: 2em;
  background-color: var(--color-theme);
  border-left: 1px solid #000;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: url("/android-chrome-192x192.png");
    background-repeat: no-repeat;
    background-size: 75px;
    transform: scaleX(-1);
    z-index: -1;
  }
}
</style>
