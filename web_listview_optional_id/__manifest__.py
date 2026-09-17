{
    "name": "List View Optional ID",
    "summary": "Show record ID as optional list column in debug mode",
    "version": "18.0.1.0.0",
    "category": "Web",
    "license": "AGPL-3",
    "author": "Miguel Vázquez",
    "website": "https://github.com/mendezmiguel225/odoo-dev-tools",
    "depends": ["web", "sale"],
    "assets": {
        "web.assets_backend": [
            "/web_listview_optional_id/static/src/js/list_renderer.esm.js",
            "/web_listview_optional_id/static/src/xml/list_renderer.xml",
        ]
    },
}
