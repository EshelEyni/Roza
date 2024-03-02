import { createRouter, createWebHistory } from "vue-router";
import Review from "../views/Review/Review.vue";
import Book from "../views/Book/Book.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Book },

    { path: "/reviews", component: Review },
  ],
});

export default router;
