# -*- coding: utf-8 -*-
{
    'name': 'Web Debug Depends',
    'summary': 'Muestra los @api.depends en el tooltip de debug de los campos.',
    'version': '18.0.1.0.0',
    'category': 'Development Tools',
    'author': 'Miguel Vázquez <mendezmiguel0238@gmail.com>',
    'website': 'https://github.com/mendezmiguel225',
    'license': 'LGPL-3',
    'depends': [
        'web',  
        'base',    
    ],
    'data': [
    ],
    'assets': {
        'web.assets_backend': [
            'web_debug_depends/static/src/js/field_tooltip.js',
            'web_debug_depends/static/src/xml/field_tooltip.xml',
        ],
    },
    'installable': True,
    'application': False,
    'auto_install': False,
    'description': """
Explorador de Dependencias de Campos
====================================
Este módulo extiende el comportamiento del modo debug de Odoo para:
* Visualizar campos dependientes (@api.depends) directamente en el tooltip.
    """,
}