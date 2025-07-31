FROM oven/bun:alpine

RUN apk update

RUN apk upgrade

RUN apk --no-cache --update add x11vnc

RUN apk --no-cache add xvfb xfce4 xfce4-terminal supervisor sudo \
    && addgroup alpine \
    && adduser  -G alpine -s /bin/sh -D alpine \
    && echo "alpine:alpine" | /usr/sbin/chpasswd \
    && echo "alpine ALL=NOPASSWD: ALL" >> /etc/sudoers

RUN bun add express jimp vnc-rfb-client

RUN rm -rf /apk /tmp/* /var/cache/apk/*

USER alpine

ENV USER=alpine \
    DISPLAY=:1 \
    LANG=en_US.UTF-8 \
    LANGUAGE=en_US.UTF-8 \
    HOME=/home/alpine \
    TERM=xterm \
    SHELL=/bin/bash \
    VNC_PASSWD=alpinelinux \
    VNC_PORT=5900 \
    VNC_RESOLUTION=1024x768 \
    VNC_COL_DEPTH=24  \
    NOVNC_PORT=6080 \
    NOVNC_HOME=/opt/noVNC \
    EXPRESS_PORT=3000 \
    PATH="$PATH:/home/alpine"

RUN sudo apk update \
  && sudo apk add git \
  && sudo git clone https://github.com/novnc/noVNC /opt/noVNC \
  && sudo apk add bash

WORKDIR $HOME

EXPOSE $VNC_PORT $NOVNC_PORT $EXPRESS_PORT

COPY supervisord.conf /etc/supervisord.conf

COPY app.ts /home/alpine/app.ts

CMD ["sudo","/usr/bin/supervisord","-c","/etc/supervisord.conf"]
