import { Component, onMounted, onWillUnmount, useRef, useState, xml } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";
import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";
import { CodeEditor } from "@web/core/code_editor/code_editor";
import { cookie } from "@web/core/browser/cookie";

const debugRegistry = registry.category("debug");

function _nodeToString(node, depth) {
    const indent = "    ".repeat(depth);
    if (node.nodeType === 3) {
        const text = node.textContent.trim();
        return text ? indent + text : null;
    }
    if (node.nodeType === 8) {
        return `${indent}<!--${node.textContent}-->`;
    }
    const tag = node.tagName;
    if (!tag) return null;
    const attrs = Array.from(node.attributes || [])
        .map((a) => ` ${a.name}="${a.value}"`)
        .join("");
    const children = Array.from(node.childNodes)
        .map((child) => _nodeToString(child, depth + 1))
        .filter((s) => s !== null);
    if (children.length === 0) {
        return `${indent}<${tag}${attrs}/>`;
    }
    if (children.length === 1 && !children[0].includes("\n")) {
        return `${indent}<${tag}${attrs}>${children[0].trim()}</${tag}>`;
    }
    return `${indent}<${tag}${attrs}>\n${children.join("\n")}\n${indent}</${tag}>`;
}

export function formatXml(xmlStr) {
    try {
        const clean = xmlStr
            .replace(/&nbsp;/g, " ")
            .replace(/&(?!(amp|lt|gt|quot|apos);)/g, "&amp;");
        const doc = new DOMParser().parseFromString(clean, "text/xml");
        if (doc.querySelector("parsererror")) return xmlStr;
        return _nodeToString(doc.documentElement, 0);
    } catch {
        return xmlStr;
    }
}

export class CodeViewerDialog extends Component {
    static template = xml`
        <Dialog title="props.title" size="'xl'">
            <t t-set-slot="header">
                <div class="d-flex align-items-center gap-2 w-100 pe-2">
                    <h5 class="modal-title flex-shrink-0" t-esc="props.title"/>
                    <div class="input-group flex-nowrap ms-3" style="max-width:300px">
                        <input
                            type="text"
                            class="form-control form-control-sm"
                            placeholder="Search..."
                            t-model="state.query"
                            t-on-keydown="onSearchKeydown"
                        />
                        <button class="btn btn-sm btn-outline-secondary" t-on-click="() => this.find(-1)" title="Previous (Shift+Enter)">
                            <i class="fa fa-chevron-up"/>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary" t-on-click="() => this.find(1)" title="Next (Enter)">
                            <i class="fa fa-chevron-down"/>
                        </button>
                    </div>
                    <button
                        class="btn btn-sm"
                        t-att-class="{ 'btn-primary': state.matchCase, 'btn-outline-secondary': !state.matchCase }"
                        t-on-click="toggleMatchCase"
                        title="Match case"
                    >Aa</button>
                    <button
                        class="btn btn-sm btn-outline-secondary"
                        t-on-click="toggleExpanded"
                        t-att-title="state.expanded ? 'Exit fullscreen' : 'Expand'"
                    >
                        <i t-att-class="state.expanded ? 'fa fa-compress' : 'fa fa-expand'"/>
                    </button>
                    <span t-if="state.noResults" class="text-danger small text-nowrap">Not found</span>
                    <button class="btn btn-sm btn-outline-secondary ms-auto" t-on-click="copyToClipboard" title="Copy to clipboard">
                        <i class="fa fa-copy me-1"/><t t-if="state.copied">Copied!</t><t t-else="">Copy</t>
                    </button>
                    <button class="btn-close" t-on-click="props.close" aria-label="Close"/>
                </div>
            </t>
            <div t-ref="container" t-att-style="state.expanded ? 'height:88vh' : 'height:68vh'">
                <CodeEditor
                    mode="props.mode"
                    value="props.value"
                    readonly="true"
                    theme="theme"
                    class="'h-100 w-100'"
                />
            </div>
        </Dialog>
    `;
    static components = { Dialog, CodeEditor };
    static props = {
        value: { type: String },
        mode: { type: String },
        title: { type: String },
        close: { type: Function },
    };

    setup() {
        this.containerRef = useRef("container");
        this.state = useState({
            query: "",
            matchCase: false,
            noResults: false,
            copied: false,
            expanded: false,
        });
        this.onFullscreenChange = () => {
            this.state.expanded = document.fullscreenElement === this.containerRef.el;
        };
        onMounted(() => {
            const aceEl = this.containerRef.el?.querySelector(".ace_editor");
            if (aceEl) {
                this.aceEditor = window.ace.edit(aceEl);
                this.aceEditor.renderer.setOptions({
                    showGutter: true,
                });
                this.aceEditor.setShowFoldWidgets(true);
                this.aceEditor.getSession().setFoldStyle("markbegin");
            }
            document.addEventListener("fullscreenchange", this.onFullscreenChange);
        });
        onWillUnmount(() => {
            document.removeEventListener("fullscreenchange", this.onFullscreenChange);
        });
    }

    get theme() {
        return cookie.get("color_scheme") === "dark" ? "monokai" : "";
    }

    find(direction) {
        if (!this.aceEditor || !this.state.query) return;
        const found = this.aceEditor.find(this.state.query, {
            backwards: direction < 0,
            wrap: true,
            caseSensitive: this.state.matchCase,
            regExp: false,
            wholeWord: false,
        });
        this.state.noResults = !found;
    }

    onSearchKeydown(ev) {
        if (ev.key === "Enter") {
            this.find(ev.shiftKey ? -1 : 1);
        }
    }

    toggleMatchCase() {
        this.state.matchCase = !this.state.matchCase;
        this.state.noResults = false;
    }

    async toggleExpanded() {
        try {
            if (document.fullscreenElement === this.containerRef.el) {
                await document.exitFullscreen();
            } else if (!document.fullscreenElement && this.containerRef.el?.requestFullscreen) {
                await this.containerRef.el.requestFullscreen();
            } else {
                this.state.expanded = !this.state.expanded;
            }
        } catch {
            this.state.expanded = !this.state.expanded;
        }
    }

    copyToClipboard() {
        navigator.clipboard.writeText(this.props.value).then(() => {
            this.state.copied = true;
            setTimeout(() => {
                this.state.copied = false;
            }, 1500);
        });
    }
}

export class GetViewDialogXml extends Component {
    static template = xml`
        <CodeViewerDialog title="props.title" value="props.arch" mode="'qweb'" close="props.close"/>
    `;
    static components = { CodeViewerDialog };
    static props = {
        arch: { type: String },
        title: { type: String },
        close: { type: Function },
    };
}

export function getViewXml({ component, env }) {
    return {
        type: "item",
        description: _t("Computed Arch XML"),
        callback: () => {
            env.services.dialog.add(GetViewDialogXml, {
                arch: formatXml(component.env.config.rawArch),
                title: _t("Computed Arch XML"),
            });
        },
        sequence: 271,
        section: "ui",
    };
}

debugRegistry.category("view").add("getViewXml", getViewXml);
