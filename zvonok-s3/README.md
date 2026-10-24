# Zvonok S3 (RustFS)

Standalone Compose project. RustFS stores files in the persistent `objects` volume. On startup, Compose waits for RustFS health, writes the `mc` alias, then idempotently creates bucket `zvonok-data`.

## Start

Copy `.env.example` to `.env`, set strong different credentials and the same Docker network as Backend, then run:

```sh
docker compose up -d --wait
docker compose ps
```

Backend uses `http://zvonok-s3:9000` inside Docker. Local host access is `http://127.0.0.1:19000`. Keep the port bound to `127.0.0.1` on a developer machine. On a server, publish through a protected TLS reverse proxy and use that HTTPS address for signed URLs.

The `mc-config` volume stores the `mc` alias credentials for the one-shot init containers. `docker compose down` preserves both volumes. `docker compose down -v` deletes both the credentials and stored objects.

## Backend `.env`

For a throwaway local setup, use the same credentials as RustFS:

```dotenv
S3_PROVIDER=rustfs
S3_ENDPOINT=http://zvonok-s3:9000
S3_SIGNING_ENDPOINT=http://localhost:19000
S3_BUCKET=zvonok-data
S3_REGION=us-east-1
S3_ACCESS_KEY=<same as RUSTFS_ACCESS_KEY>
S3_SECRET_ACCESS_KEY=<same as RUSTFS_SECRET_KEY>
S3_ALLOW_LOOPBACK_HTTP=true
```

Backend and RustFS must share the external Docker network. Restart/recreate Backend after changing its environment. Signed URL endpoint must be reachable by the client; remote users need a public HTTPS address instead of localhost. For a server, provision a bucket-scoped application identity and do not use the RustFS root credentials for Backend traffic.

The `mc` jobs run at `docker compose up`, create the bucket once, and exit successfully. Compose runs them again on subsequent `up` commands; `--ignore-existing` keeps this safe.
