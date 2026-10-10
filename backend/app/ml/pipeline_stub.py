"""Stub ML pipeline for serverless (Bedrock) deployments — Class Lab disabled."""


class LivePredictor:
    def __init__(self, models_dir: str):
        self.models_dir = models_dir
        self.clf = None

    def load_model(self):
        return None

    def is_trained(self) -> bool:
        return False

    def predict(self, image_path: str):
        raise ValueError("Class Lab is not available on the serverless Bedrock deployment.")


def get_extractor():
    raise RuntimeError("Local MobileNet extractor is not available in serverless mode.")


def extract_features_from_image(image_path: str):
    raise RuntimeError("Local feature extraction is not available in serverless mode.")


def train_classifier(dataset_dir: str, models_dir: str):
    raise ValueError("Training is not available on the serverless Bedrock deployment.")
