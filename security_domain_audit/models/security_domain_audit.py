from datetime import date, datetime

from odoo import _, api, fields, models
from odoo.exceptions import AccessError
from odoo.osv import expression
from odoo.tools import sql
from odoo.tools.safe_eval import safe_eval


class SecurityDomainAudit(models.TransientModel):
    _name = "security.domain.audit.tool"
    _description = "Security Domain Audit"

    @api.model
    def _ensure_audit_rights(self):
        if not self.env.user.has_group("base.group_system"):
            raise AccessError(_("Only Settings users can run this audit."))

    @api.model
    def _get_user(self, user_id):
        user = self.env["res.users"].browse(user_id).exists()
        if not user:
            raise AccessError(_("The selected user does not exist."))
        return user

    @api.model
    def _get_audit_env(self, user):
        company_ids = user.company_ids.ids
        if user.company_id:
            company_ids = [user.company_id.id] + [
                company_id for company_id in company_ids if company_id != user.company_id.id
            ]
        return self.with_user(user.id).with_context(
            allowed_company_ids=company_ids,
            lang=user.lang or self.env.lang,
        ).env

    @api.model
    def get_audit_users(self):
        self._ensure_audit_rights()
        users = self.env["res.users"].search(
            [("share", "=", False), ("active", "=", True)],
            order="name",
        )
        return [
            {
                "id": user.id,
                "name": user.display_name,
                "login": user.login,
            }
            for user in users
        ]

    @api.model
    def get_user_audit_payload(self, user_id):
        self._ensure_audit_rights()
        user = self._get_user(user_id)
        groups = user.groups_id.sorted(
            key=lambda g: (
                g.category_id.sequence,
                g.category_id.display_name or "",
                g.display_name,
            )
        )

        models_data = self._get_related_models(user)
        localized_user = user.with_context(lang=user.lang or self.env.lang)
        companies = localized_user.company_ids.sorted(key=lambda company: company.name or "")
        active_company = localized_user.company_id

        return {
            "user": {
                "id": user.id,
                "name": user.display_name,
                "login": user.login,
                "companies": [
                    {"id": company.id, "name": company.display_name}
                    for company in companies
                ],
                "active_company": (
                    {"id": active_company.id, "name": active_company.display_name}
                    if active_company
                    else False
                ),
            },
            "groups": [
                {
                    "id": group.id,
                    "name": group.display_name,
                    "category": group.category_id.display_name or _("No category"),
                }
                for group in groups
            ],
            "group_count": len(groups),
            "models": models_data,
            "default_model": models_data[0]["model"] if models_data else False,
        }

    @api.model
    def get_model_details(self, user_id, model_name):
        self._ensure_audit_rights()
        user = self._get_user(user_id)
        audit_env = self._get_audit_env(user)
        if not model_name:
            return {}

        model = self.env["ir.model"]._get(model_name)
        if not model:
            raise AccessError(_("The selected model does not exist."))
        if model_name not in self.env.registry.models:
            raise AccessError(
                _("The selected model is not available in the current registry.")
            )

        access_records = self.env["ir.model.access"].sudo().search(
            [
                "|",
                ("group_id", "=", False),
                ("group_id", "in", user.groups_id.ids),
                ("model_id", "=", model.id),
            ]
        )
        access_summary = {
            "perm_read": any(access_records.mapped("perm_read")),
            "perm_write": any(access_records.mapped("perm_write")),
            "perm_create": any(access_records.mapped("perm_create")),
            "perm_unlink": any(access_records.mapped("perm_unlink")),
        }

        modes_payload = {}
        mode_rules_map = {}
        mode_access_map = {
            "read": access_summary["perm_read"],
            "write": access_summary["perm_write"],
            "create": access_summary["perm_create"],
            "unlink": access_summary["perm_unlink"],
        }
        for mode in ("read", "write", "create", "unlink"):
            mode_rules = (
                audit_env["ir.rule"]
                ._get_rules(model_name, mode=mode)
                .sudo()
            )
            mode_rules_map[mode] = mode_rules
            modes_payload[mode] = self._build_mode_payload(
                audit_env, user, mode_rules, model_name, mode_access_map[mode]
            )

        related_group_ids = set(access_records.mapped("group_id").ids)
        for mode_rules in mode_rules_map.values():
            for rule in mode_rules:
                related_group_ids.update((rule.groups & user.groups_id).ids)

        related_groups = self.env["res.groups"].browse(list(related_group_ids)).sorted(
            key=lambda g: (
                g.category_id.sequence,
                g.category_id.display_name or "",
                g.display_name,
            )
        )

        related_groups_data = []
        for group in related_groups:
            group_access = access_records.filtered(lambda a: a.group_id == group)
            group_rule_count = sum(
                len(mode_rules.filtered(lambda r: group in r.groups))
                for mode_rules in mode_rules_map.values()
            )
            related_groups_data.append(
                {
                    "id": group.id,
                    "name": group.display_name,
                    "category": group.category_id.display_name or _("No category"),
                    "access_entry_count": len(group_access),
                    "rule_count": group_rule_count,
                    "perm_read": any(group_access.mapped("perm_read")),
                    "perm_write": any(group_access.mapped("perm_write")),
                    "perm_create": any(group_access.mapped("perm_create")),
                    "perm_unlink": any(group_access.mapped("perm_unlink")),
                }
            )

        return {
            "model": {
                "id": model.id,
                "model": model.model,
                "name": model.name,
            },
            "access_summary": access_summary,
            "related_groups": related_groups_data,
            "menus": self._get_related_menus(user, model_name),
            "modes": modes_payload,
        }

    @api.model
    def _get_related_menus(self, user, model_name):
        menu_model = self.env["ir.ui.menu"].with_user(user.id)
        visible_menu_ids = menu_model._visible_menu_ids()
        menus = (
            menu_model.sudo()
            .with_context(lang=user.lang or self.env.lang, **{"ir.ui.menu.full_list": True})
            .search([])
        )
        model_fields_by_action = {
            "ir.actions.act_window": "res_model",
            "ir.actions.report": "model",
            "ir.actions.server": "model_name",
        }
        related_menus = menus.filtered(
            lambda menu: menu.action
            and menu.action._name in model_fields_by_action
            and menu.action[model_fields_by_action[menu.action._name]] == model_name
        ).sorted(key=lambda menu: (menu.complete_name or "", menu.id))

        def _is_effectively_visible(menu):
            if menu.id not in visible_menu_ids:
                return False
            parent = menu.parent_id
            while parent:
                if parent.id not in visible_menu_ids:
                    return False
                parent = parent.parent_id
            return True

        return [
            {
                "id": menu.id,
                "name": menu.name,
                "complete_name": menu.complete_name,
                "action_name": menu.action.name,
                "action_type": menu.action._name,
                "visible": _is_effectively_visible(menu),
            }
            for menu in related_menus
        ]

    @api.model
    def _get_related_models(self, user):
        models = self.env["ir.model"].sudo().search([])
        user_groups = user.groups_id

        access_models = models.filtered(
            lambda model: model.access_ids.filtered(
                lambda access: (
                    access.active
                    and (
                        (not access.group_id or access.group_id in user_groups)
                        and any(
                            (
                                access.perm_read,
                                access.perm_write,
                                access.perm_create,
                                access.perm_unlink,
                            )
                        )
                    )
                )
            )
        )
        rule_models = models.filtered(
            lambda model: model.rule_ids.filtered(
                lambda rule: (
                    rule.active
                    and (not rule.groups or rule.groups & user_groups)
                    and any(
                        (
                            rule.perm_read,
                            rule.perm_write,
                            rule.perm_create,
                            rule.perm_unlink,
                        )
                    )
                )
            )
        )
        access_model_ids = set(access_models.ids)
        rule_model_ids = set(rule_models.ids)

        return [
            {
                "id": model.id,
                "name": model.name,
                "model": model.model,
                "from_access": model.id in access_model_ids,
                "from_rules": model.id in rule_model_ids,
            }
            for model in models.sorted(key=lambda m: (m.name or "", m.model or ""))
        ]

    @api.model
    def _build_mode_payload(
        self, audit_env, user, rules, model_name, has_model_access
    ):
        rules_for_eval = audit_env["ir.rule"]
        eval_context = rules_for_eval._eval_context()
        audit_model = audit_env[model_name]
        has_storage = (
            not audit_model._abstract
            and bool(audit_model._table)
            and sql.table_exists(audit_env.cr, audit_model._table)
        )

        global_domains = []
        user_group_domains = []
        rules_data = []

        for rule in rules:
            domain = safe_eval(rule.domain_force, eval_context) if rule.domain_force else []
            normalized_domain = expression.normalize_domain(domain)

            is_global = not rule.groups
            if is_global:
                global_domains.append(normalized_domain)
            if rule.groups & user.groups_id:
                user_group_domains.append(normalized_domain)

            rules_data.append(
                {
                    "id": rule.id,
                    "name": rule.name,
                    "is_global": is_global,
                    "groups": rule.groups.mapped("display_name"),
                    "domain": str(normalized_domain or []),
                    "perm_read": bool(rule.perm_read),
                    "perm_write": bool(rule.perm_write),
                    "perm_create": bool(rule.perm_create),
                    "perm_unlink": bool(rule.perm_unlink),
                }
            )

        user_groups_or = expression.OR(user_group_domains) if user_group_domains else []
        global_and = expression.AND(global_domains) if global_domains else []

        if user_group_domains:
            # Build a stable 2-operand AND to avoid nested shapes that some UI
            # domain parsers fail to render consistently.
            effective_user_domain = expression.AND([global_and, user_groups_or])
        else:
            effective_user_domain = global_and

        def _count(domain):
            if not has_storage:
                return False
            try:
                return audit_model.search_count(domain or [])
            except Exception:
                return False

        global_count = _count(global_and)
        user_groups_count = _count(user_groups_or)
        effective_user_count = _count(effective_user_domain)

        global_domain_ui = self._domain_for_ui(global_and)
        user_groups_domain_ui = self._domain_for_ui(user_groups_or)
        effective_user_domain_ui = self._domain_for_ui(effective_user_domain)

        return {
            "rules": rules_data,
            "rule_count": len(rules_data),
            "has_model_access": bool(has_model_access),
            "domain_selector_supported": has_storage and bool(audit_model._fields),
            "global_domain_list": global_domain_ui,
            "user_groups_domain_list": user_groups_domain_ui,
            "effective_user_domain_list": effective_user_domain_ui,
            "global_domain": str(global_domain_ui),
            "user_groups_domain": str(user_groups_domain_ui),
            "effective_user_domain": str(effective_user_domain_ui),
            "global_count": global_count,
            "user_groups_count": user_groups_count,
            "effective_user_count": effective_user_count,
        }

    @api.model
    def _domain_for_ui(self, domain):
        try:
            normalized = expression.normalize_domain(domain or [])
        except Exception:
            normalized = []
        return self._sanitize_domain_value(normalized)

    @api.model
    def _sanitize_domain_value(self, value):
        # DomainSelector expects plain serializable values. Recordsets, dates and
        # other python objects from safe_eval can break client-side parsing.
        if isinstance(value, list):
            return [self._sanitize_domain_value(v) for v in value]
        if isinstance(value, tuple):
            return [self._sanitize_domain_value(v) for v in value]
        if isinstance(value, set):
            return [self._sanitize_domain_value(v) for v in value]
        if isinstance(value, models.BaseModel):
            return value.id if len(value) == 1 else value.ids
        if isinstance(value, datetime):
            return fields.Datetime.to_string(value)
        if isinstance(value, date):
            return fields.Date.to_string(value)
        if value is None or isinstance(value, (bool, int, float, str)):
            return value
        return str(value)
