/** @odoo-module **/

import { Component, onWillStart, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { DomainSelector } from "@web/core/domain_selector/domain_selector";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";

const AUDIT_MODEL = "security.domain.audit.tool";
const SELECTION_STORAGE_KEY = "security_domain_audit.selection";

export class SecurityDomainAudit extends Component {
    static template = "security_domain_audit.SecurityDomainAudit";
    static components = { DomainSelector };

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.action = useService("action");
        const savedSelection = this._getSavedSelection();
        this.state = useState({
            loading: false,
            users: [],
            userSearch: "",
            groupCount: 0,
            models: [],
            modelSearch: "",
            selectedUserId: savedSelection.userId || false,
            selectedModel: savedSelection.model || false,
            auditUser: null,
            details: null,
        });
        this.loadSequence = 0;

        onWillStart(async () => {
            await this._loadUsers();
        });
    }

    get modeRows() {
        if (!this.state.details || !this.state.details.modes) {
            return [];
        }
        return ["read", "write", "create", "unlink"].map((mode) => ({
            mode,
            payload: this.state.details.modes[mode],
        }));
    }

    get filteredModels() {
        const search = (this.state.modelSearch || "").trim().toLowerCase();
        if (!search) {
            return this.state.models;
        }
        return this.state.models.filter(
            (model) =>
                (model.name || "").toLowerCase().includes(search) ||
                (model.model || "").toLowerCase().includes(search)
        );
    }

    get filteredUsers() {
        const search = (this.state.userSearch || "").trim().toLowerCase();
        if (!search) {
            return this.state.users;
        }
        return this.state.users.filter(
            (user) =>
                (user.name || "").toLowerCase().includes(search) ||
                (user.login || "").toLowerCase().includes(search)
        );
    }

    get selectedUser() {
        if (!this.state.selectedUserId) {
            return null;
        }
        return this.state.users.find((user) => user.id === this.state.selectedUserId) || null;
    }

    get auditCompanyNames() {
        return (
            (this.state.auditUser?.companies || []).map((company) => company.name).join(", ") ||
            "-"
        );
    }

    get hasFilteredUsers() {
        return this.filteredUsers.length > 0;
    }

    get selectedModelInfo() {
        if (!this.state.selectedModel) {
            return null;
        }
        return this.state.models.find((model) => model.model === this.state.selectedModel) || null;
    }

    modeLabel(mode) {
        const labels = {
            read: _t("Read"),
            write: _t("Write"),
            create: _t("Create"),
            unlink: _t("Delete"),
        };
        return labels[mode] || mode;
    }

    async _loadUsers() {
        this.state.loading = true;
        try {
            const users = await this.orm.call(AUDIT_MODEL, "get_audit_users", []);
            this.state.users = users;
            if (users.length) {
                const savedSelection = this._getSavedSelection();
                const selectedUser = users.find((user) => user.id === savedSelection.userId);
                this.state.selectedUserId = selectedUser ? selectedUser.id : users[0].id;
                await this._loadUserPayload(this.state.selectedUserId);
            }
        } catch {
            this.notification.add(_t("Unable to load users for the security auditor."), {
                type: "danger",
            });
        } finally {
            this.state.loading = false;
        }
    }

    async _loadUserPayload(userId) {
        const loadSequence = ++this.loadSequence;
        if (!userId) {
            this.state.auditUser = null;
            this.state.models = [];
            this.state.groupCount = 0;
            this.state.modelSearch = "";
            this.state.selectedModel = false;
            this.state.details = null;
            return;
        }
        this.state.loading = true;
        try {
            const payload = await this.orm.call(
                AUDIT_MODEL,
                "get_user_audit_payload",
                [userId]
            );
            if (loadSequence !== this.loadSequence) {
                return;
            }
            this.state.auditUser = payload.user || null;
            this.state.models = payload.models || [];
            this.state.groupCount = payload.group_count || 0;
            this.state.modelSearch = "";
            const savedSelection = this._getSavedSelection();
            const selectedModel =
                savedSelection.userId === userId &&
                this.state.models.some((model) => model.model === savedSelection.model)
                    ? savedSelection.model
                    : false;
            this.state.selectedModel = selectedModel;
            this.state.details = null;
            this._saveSelection();
            if (selectedModel) {
                await this._reloadDetails();
            }
        } catch {
            this.notification.add(_t("Unable to load security data for this user."), {
                type: "danger",
            });
        } finally {
            this.state.loading = false;
        }
    }

    async _reloadDetails() {
        if (!this.state.selectedUserId || !this.state.selectedModel) {
            this.state.details = null;
            return;
        }
        const loadSequence = this.loadSequence;
        const userId = this.state.selectedUserId;
        const modelName = this.state.selectedModel;
        this.state.loading = true;
        try {
            const details = await this.orm.call(AUDIT_MODEL, "get_model_details", [
                userId,
                modelName,
            ]);
            if (
                loadSequence === this.loadSequence &&
                userId === this.state.selectedUserId &&
                modelName === this.state.selectedModel
            ) {
                this.state.details = details;
            }
        } catch {
            this.notification.add(_t("Unable to load model details."), {
                type: "danger",
            });
        } finally {
            this.state.loading = false;
        }
    }

    async onUserSelect(userId) {
        if (!userId || userId === this.state.selectedUserId) {
            return;
        }
        this.state.details = null;
        this.state.modelSearch = "";
        this.state.selectedModel = false;
        this.state.selectedUserId = userId;
        this._saveSelection();
        await this._loadUserPayload(userId);
    }

    async onUserChange(ev) {
        const userId = parseInt(ev.target.value, 10) || false;
        await this.onUserSelect(userId);
    }

    async onUserSearchKeydown(ev) {
        if (ev.key !== "Enter" || !this.hasFilteredUsers) {
            return;
        }
        ev.preventDefault();
        await this.onUserSelect(this.filteredUsers[0].id);
    }

    clearUserSearch() {
        this.state.userSearch = "";
    }

    async onModelSelect(modelName) {
        if (!modelName || modelName === this.state.selectedModel) {
            return;
        }
        this.state.details = null;
        this.state.selectedModel = modelName;
        this._saveSelection();
        await this._reloadDetails();
    }

    async reloadAudit() {
        this._saveSelection();
        await this._loadUsers();
    }

    _getSavedSelection() {
        try {
            return JSON.parse(sessionStorage.getItem(SELECTION_STORAGE_KEY)) || {};
        } catch {
            return {};
        }
    }

    _saveSelection() {
        sessionStorage.setItem(
            SELECTION_STORAGE_KEY,
            JSON.stringify({
                userId: this.state.selectedUserId || false,
                model: this.state.selectedModel || false,
            })
        );
    }

    async openSelectedUser() {
        if (!this.selectedUser) {
            return;
        }
        try {
            const [userFormView] = await this.orm.searchRead(
                "ir.model.data",
                [["module", "=", "base"], ["name", "=", "view_users_form"]],
                ["res_id"],
                { limit: 1 }
            );
            if (!userFormView) {
                throw new Error("The standard user form view could not be found.");
            }
            const viewId = userFormView.res_id;
            await this.action.doAction({
                type: "ir.actions.act_window",
                name: _t("Users"),
                res_model: "res.users",
                view_mode: "form",
                view_id: viewId,
                views: [[viewId, "form"]],
                res_id: this.selectedUser.id,
                target: "new",
                context: {
                    search_default_filter_no_share: 1,
                    show_user_group_warning: true,
                },
            });
        } catch {
            this.notification.add(_t("Unable to open the user permissions view."), {
                type: "danger",
            });
        }
    }

    openSelectedModel() {
        if (!this.selectedModelInfo) {
            return;
        }
        this.action.doAction({
            type: "ir.actions.act_window",
            name: _t("Model: %s", this.selectedModelInfo.name),
            res_model: "ir.model",
            res_id: this.selectedModelInfo.id,
            views: [[false, "form"]],
            target: "new",
        });
    }

    openGroupPopup(groupId) {
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "res.groups",
            res_id: groupId,
            views: [[false, "form"]],
            target: "new",
        });
    }

    openRulePopup(ruleId) {
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "ir.rule",
            res_id: ruleId,
            views: [[false, "form"]],
            target: "new",
        });
    }

    openMenuPopup(menuId) {
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "ir.ui.menu",
            res_id: menuId,
            views: [[false, "form"]],
            target: "new",
        });
    }

    openCompanyPopup(companyId) {
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "res.company",
            res_id: companyId,
            views: [[false, "form"]],
            target: "new",
        });
    }

    openAllowedCompanies() {
        const companies = this.state.auditUser?.companies || [];
        if (!companies.length) {
            return;
        }
        this.action.doAction({
            type: "ir.actions.act_window",
            name: _t("Allowed companies"),
            res_model: "res.company",
            views: [[false, "list"], [false, "form"]],
            target: "new",
            domain: [["id", "in", companies.map((company) => company.id)]],
        });
    }

    openDomainRecords(domain, label) {
        this.action.doAction({
            type: "ir.actions.act_window",
            name: _t("Records - %s", label),
            res_model: this.state.selectedModel,
            views: [[false, "list"], [false, "form"]],
            target: "new",
            domain: domain || [],
        });
    }
}

registry.category("actions").add("security_domain_audit_client_tag", SecurityDomainAudit);
