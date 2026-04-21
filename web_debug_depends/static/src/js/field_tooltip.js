import { patch } from "@web/core/utils/patch";

import  { FormLabel}   from "@web/views/form/form_label";
import { ListRenderer } from "@web/views/list/list_renderer";
import { Field } from "@web/views/fields/field";

patch(FormLabel.prototype, {
    
    get tooltipInfo() {
        const res = super.tooltipInfo;
        if (odoo.debug) {
            const tooltipObj = JSON.parse(res);
            tooltipObj.field.depends = this.props.record.fields[this.props.fieldName].depends || [];
            tooltipObj.field.store = this.props.record.fields[this.props.fieldName].store;
            return JSON.stringify(tooltipObj);
        }
        return res;
    }
})

patch(ListRenderer.prototype, {
    
    makeTooltip(column) {
        const res = super.makeTooltip(column);
        if (odoo.debug) {
            const tooltipObj = JSON.parse(res);
            tooltipObj.field.depends = this.fields[column.name].depends || [];
            tooltipObj.field.store =  this.fields[column.name].store;
            return JSON.stringify(tooltipObj);
        }
        return res;
    }
})

patch(Field.prototype, {
    get tooltip() {
        const res = super.tooltip;
        if (res && Boolean(odoo.debug)) {
            const tooltipObj = JSON.parse(res);
            tooltipObj.field.depends = this.props.record.fields[this.props.name].depends || [];
            tooltipObj.field.store = this.props.record.fields[this.props.name].store;
            return JSON.stringify(tooltipObj);
        }
        return res;
    }
});