# Simple production image for the static site
FROM nginx:1.27-alpine

WORKDIR /usr/share/nginx/html

# Copy static assets
COPY index.html ./
COPY styles.css ./
COPY app.js ./

# Basic nginx config for SPA-like static serving
RUN printf '%s\n' \
  'server {' \
  '  listen 80;' \
  '  server_name _;' \
  '  root /usr/share/nginx/html;' \
  '  index index.html;' \
  '  location / {' \
  '    try_files $uri $uri/ /index.html;' \
  '  }' \
  '}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
