let points = [];
let selectedPoint = null;
let offsetX, offsetY;
let imgData = null;
let originalImageWidth, originalImageHeight;
let addingPoint = false;
let undoStack = []; // Stack to store previous states for undo functionality

document.getElementById("process-button").addEventListener("click", async () => {
    const imageInput = document.getElementById("image-input");
    if (!imageInput.files[0]) {
        alert("Please upload an image.");
        return;
    }

    const formData = new FormData();
    formData.append("image", imageInput.files[0]);

    const response = await fetch("/process-image", {
        method: "POST",
        body: formData,
    });

    const data = await response.json();

    if (data.segmented_image) {
        const processedCanvas = document.getElementById("processed-canvas");
        const ctx = processedCanvas.getContext("2d");
        const img = new Image();
        img.onload = () => {
            processedCanvas.width = 640;
            processedCanvas.height = 360;

            originalImageWidth = img.width;
            originalImageHeight = img.height;

            ctx.drawImage(img, 0, 0, 640, 360);
            imgData = ctx.getImageData(0, 0, processedCanvas.width, processedCanvas.height);

            detectPoints(imageInput.files[0], processedCanvas);
        };
        img.src = `data:image/jpeg;base64,${data.segmented_image}`;
    }
});

async function detectPoints(file, canvas) {
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch("/detect-points", {
        method: "POST",
        body: formData,
    });

    const data = await response.json();

    if (data.points) {
        const ctx = canvas.getContext("2d");
        points = data.points.map((point) => [
            point[0] * (640 / originalImageWidth),
            point[1] * (360 / originalImageHeight),
        ]);
        redrawCanvas(ctx);
    }
}

function redrawCanvas(ctx) {
    ctx.putImageData(imgData, 0, 0);
    points.forEach((point, index) => drawPoint(ctx, point, index));
    updatePointsList();
}

function drawPoint(ctx, point, index) {
    ctx.beginPath();
    ctx.arc(point[0], point[1], 3, 0, Math.PI * 2);
    ctx.fillStyle = "red";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "red";
    ctx.stroke();

    ctx.fillStyle = "black";
    ctx.font = "15px Arial";
    ctx.fillText(index + 1, point[0] + 8, point[1] - 8);
}

function onMouseDown(event) {
    const canvas = document.getElementById("processed-canvas");
    const x = event.offsetX;
    const y = event.offsetY;

    if (addingPoint) {
        points.push([x, y]);
        const ctx = canvas.getContext("2d");
        redrawCanvas(ctx);
        addingPoint = false;
        canvas.style.cursor = "default";
        return;
    }

    selectedPoint = null;
    points.forEach((point, index) => {
        const distance = Math.sqrt(Math.pow(point[0] - x, 2) + Math.pow(point[1] - y, 2));
        if (distance < 10) {
            selectedPoint = { point: point, index: index };
            offsetX = x - point[0];
            offsetY = y - point[1];
        }
    });
}

function onMouseMove(event) {
    if (selectedPoint) {
        const canvas = document.getElementById("processed-canvas");
        const ctx = canvas.getContext("2d");

        const x = event.offsetX;
        const y = event.offsetY;

        // Save the current state to the undo stack before moving
        if (!undoStack.length || undoStack[undoStack.length - 1] !== points) {
            undoStack.push(JSON.parse(JSON.stringify(points)));
        }

        selectedPoint.point[0] = x - offsetX;
        selectedPoint.point[1] = y - offsetY;

        redrawCanvas(ctx);
    }
}

function onMouseUp() {
    if (selectedPoint) {
        selectedPoint = null;
    }
}

document.getElementById("add-point-button").addEventListener("click", () => {
    addingPoint = true;
    const canvas = document.getElementById("processed-canvas");
    canvas.style.cursor = "crosshair";
});

document.getElementById("delete-point-button").addEventListener("click", () => {
    const pointToDelete = prompt("Enter the number of the point to delete:");
    if (!pointToDelete || isNaN(pointToDelete) || pointToDelete < 1 || pointToDelete > points.length) {
        alert("Invalid point number.");
        return;
    }

    // Save the current state to the undo stack before deleting
    undoStack.push(JSON.parse(JSON.stringify(points)));

    points.splice(pointToDelete - 1, 1);
    const canvas = document.getElementById("processed-canvas");
    const ctx = canvas.getContext("2d");
    redrawCanvas(ctx);
});

document.getElementById("undo-button").addEventListener("click", () => {
    if (undoStack.length > 0) {
        points = undoStack.pop();
        const canvas = document.getElementById("processed-canvas");
        const ctx = canvas.getContext("2d");
        redrawCanvas(ctx);
    } else {
        alert("No actions to undo.");
    }
});

document.getElementById("download-points-button").addEventListener("click", () => {
    const text = points.map((point, index) => `Point ${index + 1}: (${(point[0] * originalImageWidth / 640).toFixed(2)}, ${(point[1] * originalImageHeight / 360).toFixed(2)})`).join("\n");

    const blob = new Blob([text], { type: 'text/plain' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "points.txt";
    link.click();
});

function updatePointsList() {
    const pointsList = document.getElementById("points-list");
    pointsList.innerHTML = "";
    points.forEach((point, index) => {
        const pointItem = document.createElement("li");
        pointItem.textContent = `Point ${index + 1}: (${(point[0] * originalImageWidth / 640).toFixed(2)}, ${(point[1] * originalImageHeight / 360).toFixed(2)})`;
        pointsList.appendChild(pointItem);
    });
}

// Update point selectors whenever points change
function updatePointsList() {
    const pointsList = document.getElementById("points-list");
    pointsList.innerHTML = "";
    points.forEach((point, index) => {
        const pointItem = document.createElement("li");
        pointItem.textContent = `Point ${index + 1}: (${(point[0] * originalImageWidth / 640).toFixed(2)}, ${(point[1] * originalImageHeight / 360).toFixed(2)})`;
        pointsList.appendChild(pointItem);
    });
}

function updatePointSelectors() {
    const point1Select = document.getElementById("point1");
    const point2Select = document.getElementById("point2");

    // Clear existing options
    point1Select.innerHTML = "";
    point2Select.innerHTML = "";

    // Populate options with updated points
    points.forEach((_, index) => {
        const option1 = document.createElement("option");
        option1.value = index;
        option1.textContent = `Point ${index + 1}`;
        point1Select.appendChild(option1);

        const option2 = document.createElement("option");
        option2.value = index;
        option2.textContent = `Point ${index + 1}`;
        point2Select.appendChild(option2);
    });
}

document.getElementById("calculate-distance-button").addEventListener("click", () => {
    const point1Index = parseInt(document.getElementById("point1").value, 10);
    const point2Index = parseInt(document.getElementById("point2").value, 10);

    if (isNaN(point1Index) || isNaN(point2Index)) {
        alert("Please select both points.");
        return;
    }

    const point1 = points[point1Index];
    const point2 = points[point2Index];

    const horizontalDistance = Math.abs(point1[0] - point2[0]) * (originalImageWidth / 640);
    document.getElementById("distance-result").textContent = `Horizontal Distance: ${horizontalDistance.toFixed(2)} px`;
});

// Update point selectors whenever points change
function updatePointsList() {
    const pointsList = document.getElementById("points-list");
    pointsList.innerHTML = "";
    points.forEach((point, index) => {
        const pointItem = document.createElement("li");
        pointItem.textContent = `Point ${index + 1}: (${(point[0] * originalImageWidth / 640).toFixed(2)}, ${(point[1] * originalImageHeight / 360).toFixed(2)})`;
        pointsList.appendChild(pointItem);
    });
    updatePointSelectors(); // Update dropdowns
}



const canvas = document.getElementById("processed-canvas");
canvas.addEventListener("mousedown", onMouseDown);
canvas.addEventListener("mousemove", onMouseMove);
canvas.addEventListener("mouseup", onMouseUp);
