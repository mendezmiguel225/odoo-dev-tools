from odoo import models


class IrHttp(models.AbstractModel):
    _inherit = 'ir.http'

    def session_info(self):
        res = super().session_info()
        res["pdf_debug_mode"] = self.env.user.pdf_debug_mode
        return res
