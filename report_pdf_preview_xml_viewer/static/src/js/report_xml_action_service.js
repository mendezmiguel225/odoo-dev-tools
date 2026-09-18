import { _t } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { ReportAction } from "@web/webclient/actions/reports/report_action";
import { CodeViewerDialog, formatXml } from "@web_xml_viewer/js/xml_viewer";

function extractDirectTCall(xmlContent) {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(xmlContent, "application/xml");
    if (parsed.querySelector("parsererror") || !parsed.documentElement) {
        return null;
    }

    const root = parsed.documentElement;
    const rootDirectCall = root.getAttribute && root.getAttribute("t-call");
    if (rootDirectCall) {
        return rootDirectCall;
    }

    const significantChildren = Array.from(root.childNodes || []).filter((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
            return child.textContent.trim();
        }
        return child.nodeType === Node.ELEMENT_NODE;
    });

    if (significantChildren.length !== 1) {
        return null;
    }

    const child = significantChildren[0];
    if (child.tagName !== "t") {
        return null;
    }

    const hasMeaningfulSubnodes = Array.from(child.childNodes || []).some((subnode) => {
        if (subnode.nodeType === Node.TEXT_NODE) {
            return subnode.textContent.trim();
        }
        return subnode.nodeType === Node.ELEMENT_NODE;
    });

    if (hasMeaningfulSubnodes) {
        return null;
    }

    return child.getAttribute("t-call");
}

function extractAllTCalls(xmlContent) {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(xmlContent, "application/xml");
    if (parsed.querySelector("parsererror") || !parsed.documentElement) {
        return [];
    }

    const calls = [];
    const stack = [parsed.documentElement];
    while (stack.length) {
        const node = stack.pop();
        if (node.nodeType === Node.ELEMENT_NODE) {
            const tCall = node.getAttribute && node.getAttribute("t-call");
            if (tCall) {
                calls.push(tCall);
            }
            for (const child of Array.from(node.childNodes || [])) {
                if (child.nodeType === Node.ELEMENT_NODE) {
                    stack.push(child);
                }
            }
        }
    }
    return calls;
}

function isLayoutWrapperTemplate(templateName) {
    return [
        "web.html_container",
        "web.report_layout",
        "web.external_layout",
        "web.basic_layout",
    ].includes(templateName);
}

function isWebTemplate(templateName) {
    return templateName && templateName.startsWith("web.");
}

patch(ReportAction.prototype, {
    setup() {
        super.setup(...arguments);
        this.dialog = useService("dialog");
        this.notification = useService("notification");
        this.orm = useService("orm");
    },

    async openReportXmlPopup() {
        try {
            const reportName = this.props.action.report_name;
            if (!reportName) {
                throw new Error("Missing report_name");
            }

            const seen = new Set();
            let currentTemplate = reportName;
            let currentXml = "";
            const resolvedTemplates = [];

            for (let depth = 0; depth < 10; depth++) {
                if (seen.has(currentTemplate)) {
                    break;
                }
                seen.add(currentTemplate);

                const views = await this.orm.searchRead(
                    "ir.ui.view",
                    [["key", "=", currentTemplate]],
                    ["id"],
                    { limit: 1 }
                );

                if (!views.length) {
                    throw new Error("Report template not found");
                }

                currentXml = await this.orm.call("ir.ui.view", "get_combined_arch", [[views[0].id]]);
                resolvedTemplates.push(currentTemplate);

                const nextTemplate = extractDirectTCall(currentXml);
                if (!nextTemplate || seen.has(nextTemplate) || isLayoutWrapperTemplate(nextTemplate)) {
                    break;
                }
                currentTemplate = nextTemplate;
            }

            const templateXmlCache = new Map();
            templateXmlCache.set(currentTemplate, currentXml);

            const referencedTemplates = [{ name: currentTemplate, xml: currentXml }];
            const queued = [currentTemplate];
            const queuedSet = new Set([currentTemplate]);

            for (let idx = 0; idx < queued.length && referencedTemplates.length < 30; idx++) {
                const templateName = queued[idx];
                const xmlForTemplate = templateXmlCache.get(templateName);
                if (!xmlForTemplate) {
                    continue;
                }

                for (const calledTemplate of extractAllTCalls(xmlForTemplate)) {
                    if (
                        queuedSet.has(calledTemplate) ||
                        isLayoutWrapperTemplate(calledTemplate) ||
                        isWebTemplate(calledTemplate)
                    ) {
                        continue;
                    }

                    const views = await this.orm.searchRead(
                        "ir.ui.view",
                        [["key", "=", calledTemplate]],
                        ["id"],
                        { limit: 1 }
                    );
                    if (!views.length) {
                        continue;
                    }

                    const calledXml = await this.orm.call("ir.ui.view", "get_combined_arch", [[views[0].id]]);
                    templateXmlCache.set(calledTemplate, calledXml);
                    referencedTemplates.push({ name: calledTemplate, xml: calledXml });
                    queued.push(calledTemplate);
                    queuedSet.add(calledTemplate);
                }
            }

            const callChain = resolvedTemplates.join(" -> ");
            const sections = referencedTemplates.map(
                (templateData) =>
                    `<!-- Template: ${templateData.name} -->\n${formatXml(templateData.xml)}`
            );
            const content = [`<!-- t-call resuelto: ${callChain} -->`, ...sections].join("\n\n");

            this.dialog.add(CodeViewerDialog, {
                title: _t("Estructura XML combinada (expandida)"),
                value: content,
                mode: "qweb",
            });
        } catch {
            this.notification.add(_t("No se pudo cargar la estructura XML combinada del reporte."), {
                type: "danger",
            });
        }
    },
});
