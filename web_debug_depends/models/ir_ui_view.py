from odoo import _, api, fields, models


class Model(models.AbstractModel):
    _inherit = 'base'

    @api.model
    def _get_view_field_attributes(self):
        res = super()._get_view_field_attributes()
        res.append('depends')
        return res