{
    "name": "Security Domain Audit",
    "version": "18.0.1.0.0",
    "category": "Technical",
    "summary": "Audit model access and record rules for a selected user",
    "author": "Miguel Vazquez",
    "license": "AGPL-3",
    "depends": ["base", "web"],
    "data": [
        "security/ir.model.access.csv",
        "views/security_domain_audit_views.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "security_domain_audit/static/src/js/security_domain_audit.js",
            "security_domain_audit/static/src/xml/security_domain_audit.xml",
            "security_domain_audit/static/src/scss/security_domain_audit.scss",
        ],
    },
    "installable": True,
    "application": False,
}
