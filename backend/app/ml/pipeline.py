import os
import time
import json
import pickle
import torch
import torch.nn as nn
from torchvision.models import mobilenet_v3_small, MobileNet_V3_Small_Weights
from torchvision import transforms
from PIL import Image
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix

# Initialize device
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Preprocessing transforms (ImageNet standard normalization)
img_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

class FeatureExtractor(nn.Module):
    def __init__(self):
        super().__init__()
        # Pre-load pretrained weights (approx. 10MB)
        weights = MobileNet_V3_Small_Weights.DEFAULT
        self.backbone = mobilenet_v3_small(weights=weights)
        # Replace classifier with Identity to keep feature vectors
        self.backbone.classifier = nn.Identity()
        self.backbone.to(device)
        self.backbone.eval()

    def forward(self, x):
        with torch.no_grad():
            # The forward method of MobileNetV3 flattens avgpool output to [B, 576]
            # before passing to classifier, so this returns [B, 576]
            return self.backbone(x)

# Global extractor instance
_extractor = None

def get_extractor():
    global _extractor
    if _extractor is None:
        _extractor = FeatureExtractor()
    return _extractor

def extract_features_from_image(image_path: str) -> np.ndarray:
    """Load image, preprocess, and extract 576-dim feature vector."""
    extractor = get_extractor()
    img = Image.open(image_path).convert("RGB")
    tensor = img_transform(img).unsqueeze(0).to(device)
    features = extractor(tensor)
    return features.squeeze(0).cpu().numpy()

def train_classifier(dataset_dir: str, models_dir: str):
    """
    Scans dataset_dir for classes, extracts MobileNetV3 features,
    trains a LogisticRegression classifier, and saves the pipeline artifacts.
    """
    start_time = time.time()
    
    # 1. Collect classes and image paths
    classes = sorted([d for d in os.listdir(dataset_dir) if os.path.isdir(os.path.join(dataset_dir, d))])
    if len(classes) < 2:
        raise ValueError("Minimum 2 classes are required to train a model.")
    
    X = []
    y = []
    label_to_index = {cls_name: i for i, cls_name in enumerate(classes)}
    index_to_label = {i: cls_name for i, cls_name in enumerate(classes)}
    
    sample_counts = {}
    
    for cls_name in classes:
        cls_dir = os.path.join(dataset_dir, cls_name)
        img_names = [f for f in os.listdir(cls_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))]
        sample_counts[cls_name] = len(img_names)
        
        if len(img_names) == 0:
            raise ValueError(f"Class '{cls_name}' has 0 samples. Add at least 1 image to train.")
            
        for img_name in img_names:
            img_path = os.path.join(cls_dir, img_name)
            try:
                feat = extract_features_from_image(img_path)
                X.append(feat)
                y.append(label_to_index[cls_name])
            except Exception as e:
                print(f"Skipping corrupted image {img_path}: {e}")
                
    X = np.array(X)
    y = np.array(y)
    
    if len(X) < 4:
        raise ValueError("Please upload at least 4 total images across your classes to begin training.")
        
    # 2. Train Logistic Regression
    # We use penalty='l2' and C=1.0. multi_class auto-resolves for binary/multiclass
    clf = LogisticRegression(max_iter=1000, C=1.0, random_state=42)
    clf.fit(X, y)
    
    # 3. Compute Metrics
    y_pred = clf.predict(X)
    accuracy = float(accuracy_score(y, y_pred))
    
    # Confusion matrix
    cm = confusion_matrix(y, y_pred)
    cm_list = cm.tolist()
    
    training_time = time.time() - start_time
    
    # 4. Save artifacts
    os.makedirs(models_dir, exist_ok=True)
    
    # Save classifier
    model_path = os.path.join(models_dir, "model.pkl")
    with open(model_path, "wb") as f:
        pickle.dump(clf, f)
        
    # Save label mappings
    labels_path = os.path.join(models_dir, "labels.json")
    with open(labels_path, "w") as f:
        json.dump({
            "label_to_index": label_to_index,
            "index_to_label": {str(k): v for k, v in index_to_label.items()}
        }, f, indent=2)
        
    # Save training metrics
    metrics_path = os.path.join(models_dir, "metrics.json")
    metrics_data = {
        "accuracy": accuracy,
        "sample_counts": sample_counts,
        "training_time_seconds": training_time,
        "confusion_matrix": cm_list,
        "classes": classes,
        "trained_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    with open(metrics_path, "w") as f:
        json.dump(metrics_data, f, indent=2)
        
    return metrics_data

class LivePredictor:
    def __init__(self, models_dir: str):
        self.models_dir = models_dir
        self.model_path = os.path.join(models_dir, "model.pkl")
        self.labels_path = os.path.join(models_dir, "labels.json")
        
        self.clf = None
        self.label_to_index = None
        self.index_to_label = None
        
        self.load_model()
        
    def load_model(self):
        if os.path.exists(self.model_path) and os.path.exists(self.labels_path):
            with open(self.model_path, "rb") as f:
                self.clf = pickle.load(f)
            with open(self.labels_path, "r") as f:
                data = json.load(f)
                self.label_to_index = data["label_to_index"]
                # Convert keys back to integers for labels lookup
                self.index_to_label = {int(k): v for k, v in data["index_to_label"].items()}
        else:
            self.clf = None
            self.label_to_index = None
            self.index_to_label = None

    def is_trained(self) -> bool:
        return self.clf is not None

    def predict(self, image_path: str):
        """Run feature extraction and make prediction using trained LogisticRegression."""
        if not self.is_trained():
            raise ValueError("Classifier is not trained yet. Train the model first.")
            
        # Extract features
        feat = extract_features_from_image(image_path)
        feat_reshaped = feat.reshape(1, -1)
        
        # Predict class index
        predicted_idx = int(self.clf.predict(feat_reshaped)[0])
        predicted_class = self.index_to_label[predicted_idx]
        
        # Predict probabilities
        probabilities = self.clf.predict_proba(feat_reshaped)[0]
        
        # Build nice response mapping label -> confidence
        probs_dict = {}
        for idx, prob in enumerate(probabilities):
            cls_name = self.index_to_label[idx]
            probs_dict[cls_name] = float(prob)
            
        confidence = probs_dict[predicted_class]
        
        return {
            "predicted_class": predicted_class,
            "confidence": confidence,
            "probabilities": probs_dict
        }
