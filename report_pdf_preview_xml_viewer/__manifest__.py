{
    "name": "Report PDF Preview XML Viewer",
    "version": "18.0.1.0.0",
    "summary": "View full report QWeb XML from PDF preview",
    "license": "LGPL-3",
    "author": "Miguel Vázquez <mendezmiguel0238@gmail.com>",
    "category": "Reporting",
    "website": "https://github.com/mendezmiguel225/odoo-dev-tools",
    "depends": [
        "report_pdf_preview",
        "web_xml_viewer",
    ],
    "data": [],
    "assets": {
        "web.assets_backend": [
            "report_pdf_preview_xml_viewer/static/src/js/report_xml_action_service.js",
            "report_pdf_preview_xml_viewer/static/src/xml/report_action.xml",
        ],
    },
    "installable": True,
    "application": False,
}
