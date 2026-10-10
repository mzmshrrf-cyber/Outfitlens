import os
import io
import uuid
import shutil
import base64
import zipfile
from typing import List
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from PIL import Image

import numpy as np

# Local Class Lab uses PyTorch MobileNet; serverless uses Bedrock stubs.
if os.getenv("OUTFITLENS_SERVERLESS", "").lower() in {"1", "true", "yes"}:
    from app.ml.pipeline_stub import train_classifier, LivePredictor, extract_features_from_image
else:
    from app.ml.pipeline import train_classifier, LivePredictor, extract_features_from_image

# Establish paths relative to this file.
# On AWS Lambda the deployment package is read-only — use /tmp instead.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if os.getenv("OUTFITLENS_SERVERLESS", "").lower() in {"1", "true", "yes"} or os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
    DATASET_DIR = os.path.join("/tmp", "outfitlens", "dataset")
    MODELS_DIR = os.path.join("/tmp", "outfitlens", "models")
else:
    DATASET_DIR = os.path.join(BASE_DIR, "dataset")
    MODELS_DIR = os.path.join(BASE_DIR, "models")

# Initialize global predictor
predictor = LivePredictor(MODELS_DIR)

router = APIRouter()

# Schema for base64 prediction request
class PredictRequest(BaseModel):
    image: str  # Can be base64 string or data URL (e.g. data:image/jpeg;base64,...)

# Ensure folders exist (writable path on Lambda)
os.makedirs(DATASET_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)

def get_base64_thumbnail(file_path: str, max_size=(80, 80)) -> str:
    """Helper to load an image, downscale it, and convert to base64 for fast frontend rendering."""
    try:
        with Image.open(file_path) as img:
            img.thumbnail(max_size)
            buffered = io.BytesIO()
            img.save(buffered, format="JPEG", quality=75)
            img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
            return f"data:image/jpeg;base64,{img_str}"
    except Exception as e:
        print(f"Error creating thumbnail for {file_path}: {e}")
        return ""

@router.post("/upload-sample")
async def upload_sample(
    class_name: str = Form(...),
    images: List[UploadFile] = File(...)
):
    """
    Accepts images for a class, validates and saves them in dataset/{class_name}/.
    Generates UUIDs for filenames and returns list of successfully saved items.
    """
    cleaned_class_name = class_name.strip()
    if not cleaned_class_name:
        raise HTTPException(status_code=400, detail="Class name cannot be empty.")
        
    class_dir = os.path.join(DATASET_DIR, cleaned_class_name)
    os.makedirs(class_dir, exist_ok=True)
    
    saved_samples = []
    
    for img_file in images:
        # Generate unique ID
        sample_id = str(uuid.uuid4())
        file_ext = os.path.splitext(img_file.filename)[1] or ".jpg"
        if file_ext.lower() not in ['.png', '.jpg', '.jpeg', '.webp']:
            file_ext = ".jpg"
            
        filename = f"{sample_id}{file_ext}"
        filepath = os.path.join(class_dir, filename)
        
        try:
            # Read and validate image content
            contents = await img_file.read()
            img = Image.open(io.BytesIO(contents)).convert("RGB")
            
            # Save original image (resized slightly if too massive to save disk space, e.g. max 640px)
            img.thumbnail((640, 640))
            img.save(filepath, format="JPEG", quality=85)
            
            # Generate small base64 thumbnail for instant preview in UI
            thumbnail_b64 = get_base64_thumbnail(filepath)
            
            saved_samples.append({
                "id": sample_id,
                "filename": filename,
                "class_name": cleaned_class_name,
                "thumbnail": thumbnail_b64
            })
        except Exception as e:
            # Clean up if partially written
            if os.path.exists(filepath):
                os.remove(filepath)
            print(f"Error uploading image {img_file.filename}: {e}")
            
    if not saved_samples:
        raise HTTPException(
            status_code=400, 
            detail="Failed to upload any valid images. Ensure they are PNG, JPG, or WebP format."
        )
        
    return {
        "message": f"Successfully uploaded {len(saved_samples)} images.",
        "samples": saved_samples
    }

@router.get("/classes")
async def get_classes():
    """
    Scans dataset folder and returns a list of classes, their total sample counts,
    and a small preview list of sample base64 thumbnails.
    """
    classes_list = []
    if not os.path.exists(DATASET_DIR):
        return {"classes": []}
        
    classes = sorted([d for d in os.listdir(DATASET_DIR) if os.path.isdir(os.path.join(DATASET_DIR, d))])
    
    for cls_name in classes:
        cls_dir = os.path.join(DATASET_DIR, cls_name)
        # Gather all image files
        all_files = sorted([
            f for f in os.listdir(cls_dir) 
            if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))
        ])
        
        # Take the most recent 6 samples as thumbnails
        previews = []
        for filename in all_files[-6:]:
            filepath = os.path.join(cls_dir, filename)
            sample_id = os.path.splitext(filename)[0]
            thumbnail = get_base64_thumbnail(filepath)
            previews.append({
                "id": sample_id,
                "filename": filename,
                "thumbnail": thumbnail
            })
            
        classes_list.append({
            "name": cls_name,
            "count": len(all_files),
            "previews": previews
        })
        
    return {"classes": classes_list}

@router.delete("/class/{name}")
async def delete_class(name: str):
    """Deletes the entire directory of a class, wiping out its images."""
    class_dir = os.path.join(DATASET_DIR, name)
    if not os.path.exists(class_dir):
        raise HTTPException(status_code=404, detail=f"Class '{name}' does not exist.")
        
    try:
        shutil.rmtree(class_dir)
        # Reload live predictor just in case the active model was trained on deleted labels
        predictor.load_model()
        return {"message": f"Successfully deleted class '{name}' and all associated samples."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete class directory: {str(e)}")

@router.post("/class/rename")
async def rename_class(old_name: str = Form(...), new_name: str = Form(...)):
    """Renames a dataset class directory."""
    cleaned_old_name = old_name.strip()
    cleaned_new_name = new_name.strip()
    if not cleaned_old_name or not cleaned_new_name:
        raise HTTPException(status_code=400, detail="Class names cannot be empty.")
        
    old_dir = os.path.join(DATASET_DIR, cleaned_old_name)
    new_dir = os.path.join(DATASET_DIR, cleaned_new_name)
    
    if not os.path.exists(old_dir):
        raise HTTPException(status_code=404, detail=f"Class '{cleaned_old_name}' not found.")
    if os.path.exists(new_dir) and cleaned_old_name.lower() != cleaned_new_name.lower():
        raise HTTPException(status_code=400, detail=f"Class '{cleaned_new_name}' already exists.")
        
    try:
        os.rename(old_dir, new_dir)
        predictor.load_model()
        return {"message": f"Successfully renamed class '{cleaned_old_name}' to '{cleaned_new_name}'."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to rename class directory: {str(e)}")


@router.delete("/sample/{class_name}/{id}")
async def delete_sample(class_name: str, id: str):
    """Deletes an individual image in a specific class by its UUID filename."""
    class_dir = os.path.join(DATASET_DIR, class_name)
    if not os.path.exists(class_dir):
        raise HTTPException(status_code=404, detail=f"Class '{class_name}' does not exist.")
        
    # Find the file starting with the sample UUID
    target_file = None
    for f in os.listdir(class_dir):
        if f.startswith(id):
            target_file = f
            break
            
    if not target_file:
        raise HTTPException(status_code=404, detail="Sample not found.")
        
    try:
        os.remove(os.path.join(class_dir, target_file))
        return {"message": "Sample successfully deleted."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete image: {str(e)}")

@router.post("/train")
async def train():
    """Trains the Logistic Regression classifier on extracted MobileNetV3 features."""
    try:
        metrics = train_classifier(DATASET_DIR, MODELS_DIR)
        # Reload predictor to pick up new weights
        predictor.load_model()
        return {
            "status": "success",
            "message": "Model trained successfully.",
            "metrics": metrics
        }
    except ValueError as ve:
        return {
            "status": "error",
            "message": str(ve),
            "metrics": None
        }

@router.post("/evaluate")
async def evaluate():
    """
    Performs a deep evaluation of the classifier on the dataset.
    Runs Stratified Cross-Validation or a Train-Test split validation to assess true generalization accuracy.
    """
    if not os.path.exists(DATASET_DIR):
        raise HTTPException(status_code=400, detail="No dataset found to evaluate.")
        
    classes = sorted([d for d in os.listdir(DATASET_DIR) if os.path.isdir(os.path.join(DATASET_DIR, d))])
    if len(classes) < 2:
        raise HTTPException(status_code=400, detail="Minimum 2 classes are required for evaluation.")
        
    X = []
    y = []
    label_to_index = {cls_name: i for i, cls_name in enumerate(classes)}
    
    for cls_name in classes:
        cls_dir = os.path.join(DATASET_DIR, cls_name)
        img_names = [f for f in os.listdir(cls_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))]
        for img_name in img_names:
            img_path = os.path.join(cls_dir, img_name)
            try:
                feat = extract_features_from_image(img_path)
                X.append(feat)
                y.append(label_to_index[cls_name])
            except Exception:
                pass
                
    X = np.array(X)
    y = np.array(y)
    
    if len(X) < 4:
        raise HTTPException(status_code=400, detail="Please upload at least 4 total images to perform evaluation.")
        
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import StratifiedKFold, cross_val_score
    from sklearn.metrics import precision_recall_fscore_support, accuracy_score
    
    # Calculate fold count safely
    class_counts = np.bincount(y)
    min_samples_per_class = int(np.min(class_counts))
    n_splits = min(3, min_samples_per_class)
    
    clf = LogisticRegression(max_iter=1000, C=1.0, random_state=42)
    
    if n_splits >= 2:
        cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
        cv_scores = cross_val_score(clf, X, y, cv=cv)
        cv_mean = float(np.mean(cv_scores))
        cv_std = float(np.std(cv_scores))
        method = f"{n_splits}-Fold Stratified Cross-Validation"
    else:
        # Fallback to train/test split if samples are too few for cross validation folds
        from sklearn.model_selection import train_test_split
        stratify_labels = y if (len(class_counts) > 1 and min_samples_per_class >= 2) else None
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.25, random_state=42, stratify=stratify_labels
        )
        clf.fit(X_train, y_train)
        y_pred = clf.predict(X_test)
        cv_mean = float(accuracy_score(y_test, y_pred))
        cv_std = 0.0
        method = "Train-Test Split (25% holdout validation)"
        
    # Fit on all data to compute detailed classification report
    clf.fit(X, y)
    y_pred = clf.predict(X)
    
    precision, recall, f1, _ = precision_recall_fscore_support(y, y_pred, average='weighted', zero_division=0)
    
    # Class-wise precision recall f1
    class_report = {}
    p_class, r_class, f_class, support = precision_recall_fscore_support(y, y_pred, zero_division=0)
    for idx, cls_name in enumerate(classes):
        class_report[cls_name] = {
            "precision": float(p_class[idx]),
            "recall": float(r_class[idx]),
            "f1_score": float(f_class[idx]),
            "support": int(support[idx])
        }
        
    # General diagnosis
    if cv_mean >= 0.90:
        diagnosis = "Excellent accuracy! The model generalizes extremely well on this dataset."
    elif cv_mean >= 0.75:
        diagnosis = "Good accuracy. Model is robust, but adding a few more diverse samples could optimize predictions."
    else:
        diagnosis = "Low generalization accuracy. The classes might have overlapping features. Try capturing images with cleaner backgrounds or clearer differences."
        
    return {
        "cross_val_accuracy": cv_mean,
        "cross_val_std": cv_std,
        "method": method,
        "precision": float(precision),
        "recall": float(recall),
        "f1_score": float(f1),
        "class_report": class_report,
        "diagnosis": diagnosis
    }

@router.post("/predict")
async def predict(request: PredictRequest):
    """
    Accepts a base64 encoded image, pre-processes it, extracts features,
    and runs inference. Returns probabilities.
    """
    if not predictor.is_trained():
        raise HTTPException(
            status_code=400, 
            detail="Model is not trained. Add samples and click 'Train' before predicting."
        )
        
    # Extract base64 image data
    try:
        header, base64_data = request.image.split(",", 1) if "," in request.image else ("", request.image)
        img_data = base64.b64decode(base64_data)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image string.")
        
    # Temporary file to feed into pipeline
    temp_filename = f"temp_inference_{uuid.uuid4()}.jpg"
    temp_path = os.path.join(MODELS_DIR, temp_filename)
    
    try:
        # Load and write temp image file
        with open(temp_path, "wb") as f:
            f.write(img_data)
            
        # Run prediction
        result = predictor.predict(temp_path)
        return result
    except Exception as e:
        print(f"Prediction inference error: {e}")
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")
    finally:
        # Guarantee cleanup of temp image file
        if os.path.exists(temp_path):
            os.remove(temp_path)

@router.post("/export-model")
async def export_model():
    """Zips model.pkl, labels.json, and metrics.json and streams it to the user."""
    model_path = os.path.join(MODELS_DIR, "model.pkl")
    labels_path = os.path.join(MODELS_DIR, "labels.json")
    metrics_path = os.path.join(MODELS_DIR, "metrics.json")
    
    if not os.path.exists(model_path) or not os.path.exists(labels_path):
        raise HTTPException(status_code=400, detail="No trained model found to export. Train first.")
        
    zip_buffer = io.BytesIO()
    try:
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            zip_file.write(model_path, arcname="model.pkl")
            zip_file.write(labels_path, arcname="labels.json")
            if os.path.exists(metrics_path):
                zip_file.write(metrics_path, arcname="metrics.json")
                
        zip_buffer.seek(0)
        
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=teachable_machine_model.zip"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate model export zip: {str(e)}")

@router.post("/reset")
async def reset():
    """Wipes out all dataset folders and trained models to start fresh."""
    try:
        # Remove datasets
        if os.path.exists(DATASET_DIR):
            for filename in os.listdir(DATASET_DIR):
                file_path = os.path.join(DATASET_DIR, filename)
                if os.path.isdir(file_path):
                    shutil.rmtree(file_path)
                    
        # Remove models
        if os.path.exists(MODELS_DIR):
            for filename in os.listdir(MODELS_DIR):
                file_path = os.path.join(MODELS_DIR, filename)
                if os.path.isfile(file_path):
                    os.remove(file_path)
                    
        # Reset predictor
        predictor.load_model()
        return {"message": "Project reset successfully. All samples and models wiped clean."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset project: {str(e)}")

@router.get("/health")
async def health():
    """Basic health check and backend diagnostic."""
    from app.services.tryon import tryon_status

    return {
        "status": "healthy",
        "product": "OutfitLens",
        "has_model": predictor.is_trained(),
        "classes_count": len(os.listdir(DATASET_DIR)) if os.path.exists(DATASET_DIR) else 0,
        "tryon": tryon_status(),
    }


# ---------------------------------------------------------------------------
# OutfitLens — Image Compare & Virtual Try-On
# ---------------------------------------------------------------------------

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
MAX_COMPARE_BYTES = 8_000_000


def _validate_upload(file: UploadFile, contents: bytes) -> None:
    if not contents:
        raise HTTPException(status_code=400, detail=f"Empty file: {file.filename or 'upload'}")
    if len(contents) > MAX_COMPARE_BYTES:
        raise HTTPException(status_code=400, detail="Each image must be 8MB or smaller.")
    content_type = (file.content_type or "").lower()
    name = (file.filename or "").lower()
    ext_ok = name.endswith((".jpg", ".jpeg", ".png", ".webp"))
    type_ok = content_type in ALLOWED_IMAGE_TYPES or content_type == "application/octet-stream"
    if not (ext_ok or type_ok):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Use PNG, JPG, or WebP.",
        )
    try:
        Image.open(io.BytesIO(contents)).verify()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Invalid image file: {exc}") from exc


@router.post("/compare")
async def compare_images_endpoint(
    image_a: UploadFile = File(...),
    image_b: UploadFile = File(...),
):
    """
    Visual similarity between two images using MobileNetV3 embeddings.
    This is NOT virtual try-on and NOT identity verification.
    """
    bytes_a = await image_a.read()
    bytes_b = await image_b.read()
    _validate_upload(image_a, bytes_a)
    _validate_upload(image_b, bytes_b)

    use_bedrock = os.getenv("USE_BEDROCK_COMPARE", "").lower() in {"1", "true", "yes"} or os.getenv(
        "OUTFITLENS_SERVERLESS", ""
    ).lower() in {"1", "true", "yes"}

    try:
        if use_bedrock:
            from app.ml.bedrock_compare import compare_images
        else:
            try:
                from app.ml.compare import compare_images
            except Exception:
                from app.ml.bedrock_compare import compare_images
        return compare_images(bytes_a, bytes_b)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Comparison failed: {exc}") from exc


class ProductUrlRequest(BaseModel):
    url: str


@router.post("/fetch-product-image")
async def fetch_product_image_endpoint(request: ProductUrlRequest):
    """Fetch a public product page image when metadata is available."""
    from app.services.product_url import fetch_product_image

    return await fetch_product_image(request.url)


@router.get("/tryon/status")
async def tryon_status_endpoint():
    from app.services.tryon import tryon_status

    return tryon_status()


@router.post("/tryon")
async def tryon_endpoint(
    person_image: UploadFile = File(...),
    garment_images: List[UploadFile] = File(...),
    category: str = Form("auto"),
    mode: str = Form("balanced"),
):
    """
    AI virtual try-on via fal.ai FASHN v1.6.
    Requires FAL_KEY. Classification alone cannot perform try-on.
    """
    from app.services.tryon import run_tryon

    person_bytes = await person_image.read()
    _validate_upload(person_image, person_bytes)

    garment_bytes_list: List[bytes] = []
    garment_types: List[str] = []
    for g in garment_images:
        g_bytes = await g.read()
        _validate_upload(g, g_bytes)
        garment_bytes_list.append(g_bytes)
        garment_types.append((g.content_type or "image/jpeg").lower())

    return await run_tryon(
        person_bytes=person_bytes,
        garment_bytes_list=garment_bytes_list,
        category=category,
        mode=mode,
        person_content_type=(person_image.content_type or "image/jpeg").lower(),
        garment_content_types=garment_types,
    )
