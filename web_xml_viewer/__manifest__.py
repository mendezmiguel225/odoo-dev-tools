{
    'name': 'Component to view XML data in a readable format',
    'version': '18.0.1.0.0',
    'description': 'Module to view XML data in a readable format',
    'summary': 'View XML data in a readable format',
    'author': 'Miguel Vázquez <mendezmiguel0238@gmail.com>',
    'website': 'https://github.com/mendezmiguel225/odoo-dev-tools',
    'license': 'LGPL-3',
    'category': 'Tools',
    'depends': [
        'web',
    ],
    'data': [
    ],
    'auto_install': False,
    'application': False,
    'assets': {
        'web.assets_backend': [
            'web_xml_viewer/static/src/js/xml_viewer.js',
        ]
    }
}
