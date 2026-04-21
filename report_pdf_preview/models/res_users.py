from odoo import _, api, fields, models


class ResUsers(models.Model):
    _inherit = 'res.users'

    pdf_debug_mode = fields.Boolean(string='PDF Debug Mode', default=False)