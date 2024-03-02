# Standard library imports
import json

# Related third-party imports
from flask import Blueprint, current_app, jsonify, request
from bson.objectid import ObjectId

review_blueprint = Blueprint("review", __name__)


def get_collection():
    return current_app.db["reviews"]


@review_blueprint.route("/reviews", methods=["GET"])
def serve_data():
    try:
        collection = get_collection()
        # Fetch all books from the collection
        books_cursor = collection.find().sort([("sortOrder", 1)])
        books = list(books_cursor)

        # MongoDB returns documents with '_id' that is not JSON serializable by default,
        # so you may need to transform it if you're sending it as JSON
        for book in books:
            book["_id"] = str(book["_id"])

        response = {"status": 200, "msg": "success", "data": books}
    except Exception as e:
        # Handle exceptions, possibly logging them and returning an error response
        response = {
            "status": 500,
            "msg": "Failed to fetch books",
            "data": [],
            "error": str(e),
        }

    return jsonify(response)


@review_blueprint.route("/reviews", methods=["POST"])
def add_review():
    try:
        collection = get_collection()
        # Get the review data from the request
        review = json.loads(request.data)
        print(review)
        # Insert the review into the collection
        sortOrder = collection.count_documents({}) + 1
        review["sortOrder"] = sortOrder
        result = collection.insert_one(review)
        response = {
            "status": 200,
            "msg": "Review added successfully",
            "data": {"_id": str(result.inserted_id)},
        }
    except Exception as e:
        # Handle exceptions, possibly logging them and returning an error response
        response = {
            "status": 500,
            "msg": "Failed to add review",
            "data": {},
            "error": str(e),
        }

    return jsonify(response)


@review_blueprint.route("/reviews", methods=["PATCH"])
def update_review():
    try:
        collection = get_collection()
        # Get the review data from the request
        review = json.loads(request.data)
        # Convert _id from string to ObjectId
        review_id = ObjectId(review["_id"])
        # Ensure _id is removed or converted before update
        review.pop("_id", None)
        # Insert the review into the collection
        result = collection.update_one({"_id": review_id}, {"$set": review})
        if result.modified_count == 0:
            response = {
                "status": 404,
                "msg": "Review not found",
                "data": {},
            }
        else:
            response = {
                "status": 200,
                "msg": "Review updated successfully",
                "data": {"_id": str(review_id)},
            }
    except Exception as e:
        # Handle exceptions, possibly logging them and returning an error response
        response = {
            "status": 500,
            "msg": "Failed to update review",
            "data": {},
            "error": str(e),
        }

    return jsonify(response)
