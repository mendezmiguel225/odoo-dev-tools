import {registry} from "@web/core/registry";
import { patch } from "@web/core/utils/patch";
import { ReportAction } from "@web/webclient/actions/reports/report_action";
import { getReportUrl } from "@web/webclient/actions/reports/utils";
import { useEnrichWithActionLinks } from "@web/webclient/actions/reports/report_hook";
import { session } from "@web/session";

async function pdfPreviewHandler(action, options, env) {
    const isPdfDebug = session.pdf_debug_mode;
    if (action.report_type === "qweb-pdf" && isPdfDebug && !action.context.pdf_preview) {
        action.context["pdf_preview"] = true;
        action.report_type = "qweb-html";
        return false;
    }
    return false;
}



patch(ReportAction.prototype, {
    setup() {
        super.setup(...arguments);
        this.isPdfPreview = this.props.action.context && this.props.action.context.pdf_preview;
        if (this.isPdfPreview) {
            this.props.action.report_type = "qweb-pdf";
            this.reportUrl = getReportUrl(this.props.action, "pdf", this.props.action.context);
        }
        useEnrichWithActionLinks(this.iframe);
    },

    async toggleReportFormat() {
        const newFormat = this.isPdfPreview ? "html" : "pdf";
        const newUrl = getReportUrl(this.props.action, newFormat, this.props.action.context);
        
        if (this.iframe.el) {
            this.iframe.el.src = newUrl;
            this.isPdfPreview = !this.isPdfPreview;
        }
    }
});


registry.category("ir.actions.report handlers").add("pdf_preview_handler", pdfPreviewHandler);