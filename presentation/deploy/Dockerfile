# The public deck: dist/ baked into the image, served by nginx.
# Nothing is bind-mounted, so a running container never changes under you:
# it is exactly the build it was made from. To publish new slides:
#   node deploy/build.mjs && docker compose -f deploy/compose.yml up -d --build
# (The live-reload dev server in the root docker-compose.yml is untouched.)
# Build context is the repo root, so dist/ is visible.
FROM nginx:1.29-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/

EXPOSE 80
