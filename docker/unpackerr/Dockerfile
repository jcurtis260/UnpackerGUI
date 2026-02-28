FROM alpine:3.21

RUN apk add --no-cache ca-certificates curl unzip

WORKDIR /runtime

# This image is optional and useful for manual binary checks.
CMD ["sh", "-c", "echo 'Use the web control plane to manage unpackerr.' && sleep infinity"]
