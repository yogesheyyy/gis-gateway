FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies required for netCDF/geospatial libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnetcdf-dev \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Cloud Run injects a $PORT environment variable
ENV PORT 8080

# Run using Gunicorn pointing to your backend app
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 backend.app:app