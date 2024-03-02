import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import Review from "../views/Review/Review.vue";
import Book from "../views/Book/Book.vue";
import BookDetails from "../views/BookDetails/BookDetails.vue";

const routes: RouteRecordRaw[] = [
  { path: "/", component: Book },
  { path: "/reviews", component: Review },
  {
    path: "/books",
    component: BookDetails,
    name: "books",
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
