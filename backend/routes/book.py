# Standard library imports
import json
from datetime import datetime

# Related third-party imports
from flask import Blueprint, current_app, jsonify, request
from bson.objectid import ObjectId

book_blueprint = Blueprint("book", __name__)


def get_collection():
    return current_app.db["books"]


@book_blueprint.route("/books", methods=["GET"])
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


@book_blueprint.route("/books/<id>", methods=["GET"])
def get_book_by_id(id):
    try:
        collection = (
            get_collection()
        )  # Ensure you have a function to get your collection
        # Convert the id from string to ObjectId for MongoDB
        book_id = ObjectId(id)
        # Find the document by its ID
        book = collection.find_one({"_id": book_id})

        if book:
            # MongoDB returns documents with '_id' that is not JSON serializable by default,
            # so you may need to transform it if you're sending it as JSON
            book["_id"] = str(book["_id"])
            response = {"status": 200, "msg": "success", "data": book}
        else:
            response = {"status": 404, "msg": "Book not found", "data": {}}
    except Exception as e:
        # Handle exceptions, possibly logging them and returning an error response
        response = {
            "status": 500,
            "msg": "Failed to fetch book",
            "data": {},
            "error": str(e),
        }

    return jsonify(response)


@book_blueprint.route("/books", methods=["POST"])
def add_book():
    try:
        collection = get_collection()
        # Get the book data from the request
        book = json.loads(request.data)
        book["createdAt"] = datetime.now()
        book["chapters"] = []
        book["charachters"] = []
        print(book)
        # Insert the book into the collection
        sortOrder = collection.count_documents({}) + 1
        book["sortOrder"] = sortOrder
        result = collection.insert_one(book)
        response = {
            "status": 200,
            "msg": "Book added successfully",
            "data": {"_id": str(result.inserted_id)},
        }
    except Exception as e:
        # Handle exceptions, possibly logging them and returning an error response
        response = {
            "status": 500,
            "msg": "Failed to add book",
            "data": [],
            "error": str(e),
        }

    return jsonify(response)


@book_blueprint.route("/books", methods=["PATCH"])
def update_book():
    try:
        collection = get_collection()
        # Get the updated book data from the request
        book = json.loads(request.data)
        # Update the book in the collection
        result = collection.update_one({"_id": ObjectId(book["_id"])}, {"$set": book})
        response = {
            "status": 200,
            "msg": "Book updated successfully",
            "data": {"_id": str(result.upserted_id)},
        }
    except Exception as e:
        # Handle exceptions, possibly logging them and returning an error response
        response = {
            "status": 500,
            "msg": "Failed to update book",
            "data": [],
            "error": str(e),
        }

    return jsonify(response)
