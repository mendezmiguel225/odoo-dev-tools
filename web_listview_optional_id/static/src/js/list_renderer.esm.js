import {ListRenderer} from "@web/views/list/list_renderer";
import {getFieldFromRegistry} from "@web/views/fields/field";
import {patch} from "@web/core/utils/patch";
import {_t} from "@web/core/l10n/translation";

patch(ListRenderer.prototype, {
    getOptionalRecordId(record) {
        return record.resId || record.data.id || "";
    },

    processAllColumn(allColumns, list) {
        const columns = super.processAllColumn(...arguments);

        if (!this.env.debug) {
            return columns;
        }

        if (!list?.fields?.id) {
            return columns;
        }

        const hasIdColumn = columns.some(
            (column) => column.type === "field" && column.name === "id"
        );
        if (hasIdColumn) {
            return columns;
        }

        const idColumn = {
            id: "__debug_optional_id__",
            type: "field",
            name: "id",
            field: getFieldFromRegistry("integer", undefined, "list"),
            fieldType: list.fields.id.type,
            widget: "__debug_optional_id__",
            label: _t("ID"),
            hasLabel: true,
            options: {},
            optional: "hide",
            readonly: "True",
            column_invisible: "False",
            attrs: {},
            decorations: {},
            sortable: true,
        };

        return [idColumn, ...columns];
    },
});
