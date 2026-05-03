FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY bolao-backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY bolao-backend/ .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "10000"]
