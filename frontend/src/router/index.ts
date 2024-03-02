import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import Review from "../views/Review/Review.vue";
import Book from "../views/Book/Book.vue";
import BookDetails from "../views/BookDetails/BookDetails.vue";
import ChapterDetails from "../views/ChapterDetails/ChapterDetails.vue";

const routes: RouteRecordRaw[] = [
  { path: "/", component: Book },
  { path: "/reviews", component: Review },
  {
    path: "/books",
    component: BookDetails,
    name: "books",
  },
  {
    path: "/chapter",
    component: ChapterDetails,
    name: "chapter",
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
