# Standard library imports
import os

# Related third-party imports
from dotenv import load_dotenv
from flask import Flask, current_app
from flask_cors import CORS
from pymongo import MongoClient
from routes.review import review_blueprint


load_dotenv()


def create_app():
    # Initialize the Flask app
    app = Flask(__name__)

    # Load environment variables
    load_dotenv()

    # Setup CORS
    CORS(app, supports_credentials=True, origins="http://localhost:5173")

    # Setup database
    setup_database(app)

    # Register blueprints
    app.register_blueprint(review_blueprint, url_prefix="/api")

    return app


def setup_database(app):
    with app.app_context():
        database_url = os.getenv("DATABASE_URL")
        client = MongoClient(database_url)
        current_app.db = client["dev_roza"]


app = create_app()


os.environ["FLASK_ENV"] = "development"

if __name__ == "__main__":
    app.run(debug=True, port=3030)
