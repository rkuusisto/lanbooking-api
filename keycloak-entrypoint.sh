#!/bin/bash
set -e

# Determine Keycloak startup mode based on KEYCLOAK_MODE environment variable
# Defaults to "production" if not set
MODE="${KEYCLOAK_MODE:-production}"

if [ "$MODE" = "dev" ]; then
    echo "Starting Keycloak in DEVELOPMENT mode..."
    # Dev mode: relax security settings, enable HTTP, disable strict hostname
    export KC_HTTP_ENABLED=true
    export KC_HOSTNAME_STRICT=false
    export KC_HOSTNAME_STRICT_HTTPS=false
    exec /opt/keycloak/bin/kc.sh start-dev --import-realm "$@"
else
    echo "Starting Keycloak in PRODUCTION mode..."
    # Production mode: use optimized build
    exec /opt/keycloak/bin/kc.sh start --optimized --import-realm "$@"
fi

