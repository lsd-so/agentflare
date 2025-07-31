FROM oven/bun:alpine

# Install system dependencies
RUN apk upgrade --no-cache --available \
    && apk add --no-cache \
      nginx \
      chromium-swiftshader \
      ttf-freefont \
      font-noto-emoji \
      supervisor \
    && apk add --no-cache \
      --repository=https://dl-cdn.alpinelinux.org/alpine/edge/community \
      font-wqy-zenhei

COPY local.conf /etc/fonts/local.conf

# Add Chrome as a user
RUN mkdir -p /usr/src/app \
    && adduser -D chrome \
    && chown -R chrome:chrome /usr/src/app

COPY nginx.conf /etc/nginx/nginx.conf

RUN touch /var/log/nginx/error.log
RUN touch /var/lib/nginx/logs/error.log

RUN chown -R chrome:chrome /var/log/nginx
RUN chown -R chrome:chrome /var/lib/nginx
RUN chown -R chrome:chrome /var/lib/nginx/logs/

# Install Node.js dependencies
RUN bun add express puppeteer-core ai @ai-sdk/anthropic zod

# Copy application files
COPY app.ts /usr/src/app/app.ts
COPY supervisord.conf /etc/supervisord.conf

RUN chown -R chrome:chrome /usr/src/app

# Run Chrome as non-privileged
USER chrome
WORKDIR /usr/src/app

ENV CHROME_BIN=/usr/bin/chromium-browser \
    CHROME_PATH=/usr/lib/chromium/ \
    EXPRESS_PORT=3000

EXPOSE 9222 3000 80

CMD ["sudo", "/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
