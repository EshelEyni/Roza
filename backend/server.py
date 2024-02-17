# Standard library imports
import json
import os

# Related third-party imports
from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS
from pymongo import MongoClient


load_dotenv()

app = Flask(__name__)

database_url = os.getenv("DATABASE_URL")
client = MongoClient(database_url)
db = client["dev_roza"]
collection = db["reviews"]

CORS(app, supports_credentials=True, origins="http://localhost:5173")


@app.route("/api/books", methods=["GET"])
def serve_data():
    try:
        # Fetch all books from the collection
        books_cursor = collection.find({})
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


os.environ["FLASK_ENV"] = "development"

if __name__ == "__main__":
    app.run(debug=True, port=3030)
