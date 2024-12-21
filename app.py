from flask import Flask, render_template, request, jsonify
import os
import cv2
import numpy as np
from ultralytics import YOLO
from PIL import Image
import io
import base64
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Initialize YOLO models
segmentation_model = YOLO("man-seg.pt")
detection_model = YOLO("best (1).pt")

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/process-image", methods=["POST"])
def process_image():
    file = request.files['image']
    if not file:
        return jsonify({"error": "No file uploaded"}), 400

    # Ensure it's an image file
    if not file.content_type.startswith('image/'):
        return jsonify({"error": "Invalid file type, only images are allowed"}), 400

    file_bytes = np.frombuffer(file.read(), np.uint8)
    image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

    # Segment image and create red mask
    results = segmentation_model(image, iou=0.9, conf=0.25)
    masks = np.zeros_like(image)
    for result in results:
        if result.masks is not None:
            for seg in result.masks.data:
                resized_mask = cv2.resize(seg.numpy().astype(np.uint8), (image.shape[1], image.shape[0]), interpolation=cv2.INTER_NEAREST)
                masks[:, :, 2] = np.maximum(masks[:, :, 2], resized_mask * 255)

    segmented_image = cv2.addWeighted(image, 1, masks, 0.25, 0)

    # Encode the segmented image to base64
    _, buffer = cv2.imencode('.jpg', segmented_image)
    segmented_image_base64 = base64.b64encode(buffer).decode('utf-8')

    return jsonify({"segmented_image": segmented_image_base64})

@app.route("/detect-points", methods=["POST"])
def detect_points():
    file = request.files['image']
    if not file:
        return jsonify({"error": "No file uploaded"}), 400

    # Ensure it's an image file
    if not file.content_type.startswith('image/'):
        return jsonify({"error": "Invalid file type, only images are allowed"}), 400

    file_bytes = np.frombuffer(file.read(), np.uint8)
    image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

    results = detection_model(image, conf=0.25, iou=0.35)
    centers = []
    for r in results:
        if r.boxes is not None:
            for box in r.boxes.xywh:
                x_center = int(box[0])
                y_center = int(box[1])
                centers.append((x_center, y_center))

    return jsonify({"points": centers})

if __name__ == "__main__":
    app.run(debug=False, host='0.0.0.0')
