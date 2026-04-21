{
    'name': 'Report PDF Preview',
    'version': '18.0.1.0.0',
    'description': 'Module to preview PDF reports',
    'summary': 'Preview PDF reports before printing',
    'author': 'Miguel Vázquez <mendezmiguel0238@gmail.com>',
    'website': 'https://github.com/mendezmiguel225/odoo-dev-tools',
    'license': 'LGPL-3',
    'category': 'Reporting',
    'depends': [
        'web',
    ],
    'data': [
        'views/res_users_preferences.xml',
    ],
    'auto_install': False,
    'application': False,
    'assets': {
        'web.assets_backend': [
            'report_pdf_preview/static/src/js/action_service.js',
            'report_pdf_preview/static/src/xml/report_action.xml',

        ]
    }
}