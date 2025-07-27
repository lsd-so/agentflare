FROM alpine:3.19

# Installs latest Chromium package.
RUN apk upgrade --no-cache --available \
    && apk add --no-cache \
      nginx \
      chromium-swiftshader \
      ttf-freefont \
      font-noto-emoji \
    && apk add --no-cache \
      --repository=https://dl-cdn.alpinelinux.org/alpine/edge/community \
      font-wqy-zenhei

COPY browser/local.conf /etc/fonts/local.conf

# Add Chrome as a user
RUN mkdir -p /usr/src/app \
    && adduser -D chrome \
    && chown -R chrome:chrome /usr/src/app

COPY browser/nginx.conf /etc/nginx/nginx.conf

RUN touch /var/log/nginx/error.log
RUN touch /var/lib/nginx/logs/error.log

RUN chown -R chrome:chrome /var/log/nginx
RUN chown -R chrome:chrome /var/lib/nginx
RUN chown -R chrome:chrome /var/lib/nginx/logs/

# Run Chrome as non-privileged
USER chrome
WORKDIR /usr/src/app

ENV CHROME_BIN=/usr/bin/chromium-browser \
    CHROME_PATH=/usr/lib/chromium/

CMD nginx && chromium-browser --headless --disable-software-rasterizer --disable-dev-shm-usage --no-sandbox --remote-debugging-address=0.0.0.0 --remote-debugging-port=9222 --user=root --proxy-bypass-list='<-loopback>'
