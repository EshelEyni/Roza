<template>
  <div class="book-review-form">
    <form @submit.prevent="submitReview">
      <div class="form-group">
        <label for="name">Book Name:</label>
        <input
          v-model="bookReview.name"
          type="text"
          id="name"
          required
          class="form-control"
          autocomplete="off"
        />
      </div>
      <div class="form-group">
        <label for="reviews">Reviews (comma-separated):</label>
        <textarea
          v-model="reviewsInput"
          type="text"
          id="reviews"
          class="form-control"
          autocomplete="off"
        />
      </div>
      <div class="form-group">
        <label for="references">References (comma-separated):</label>
        <input
          v-model="referencesInput"
          type="text"
          id="references"
          class="form-control"
          autocomplete="off"
        />
      </div>
      <button type="submit" class="btn btn-primary">Submit Review</button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, defineEmits } from "vue";
import bookReviewApiService from "../../services/bookReviewApiService";
import { BookReview } from "../../../../shared/types/books";

const emit = defineEmits();

const bookReview = ref({
  name: "",
  reviews: [],
  references: [],
  createdAt: "2021",
} as any as BookReview);

const reviewsInput = ref("");
const referencesInput = ref("");

const submitReview = async () => {
  bookReview.value.reviews = [
    {
      text: reviewsInput.value,
      createdAt: "2021",
    },
  ];

  try {
    await bookReviewApiService.add(bookReview.value);
    emit("review-added");

    bookReview.value.name = "";
    reviewsInput.value = "";
    referencesInput.value = "";
  } catch (error) {
    console.error("Failed to submit review:", error);
    alert("Failed to submit review. Please try again.");
  }
};
</script>

<style>
.book-review-form {
  max-width: 500px;
  margin: auto;
  padding: 20px;
}
.form-group {
  margin-bottom: 20px;
}
.form-control {
  width: 100%;
  padding: 10px;
  border-radius: 5px;
  border: 1px solid #ccc;
}
.btn-primary {
  color: white;
  background-color: #007bff;
  border-color: #007bff;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
}
.btn-primary:hover {
  background-color: #0056b3;
  border-color: #004085;
}
</style>
