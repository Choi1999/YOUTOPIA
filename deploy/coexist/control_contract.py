"""Reviewed same-instance control endpoint; not a claim of whole-instance restore protection."""
SCOPE='SERVICE_DATABASE_ONLY'
BASE='jdbc:postgresql://127.0.0.1:5432/youtopia_control'
ENDPOINTS={
    'HOST_LOOPBACK':BASE+'?sslmode=disable',
    'VERIFY_FULL':BASE+'?sslmode=verify-full&sslrootcert=/etc/youtopia-app/control-ca.crt',
}

def validate_connection(url,scope,policy):
    if scope!=SCOPE or policy not in ENDPOINTS or url!=ENDPOINTS[policy]:
        raise ValueError('Explicit service-database-only scope and reviewed same-instance database/transport required')
