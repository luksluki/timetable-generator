#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss

echo "Starting server..."
exec node server.js
