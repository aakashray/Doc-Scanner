import sys
import json
from sentence_transformers import SentenceTransformer

# Load a lightweight model
model = SentenceTransformer('all-MiniLM-L6-v2')

# Read text from stdin
text = sys.stdin.read().strip()

# Generate embedding
embedding = model.encode(text).tolist()

# Output as JSON
print(json.dumps({"embedding": embedding}))