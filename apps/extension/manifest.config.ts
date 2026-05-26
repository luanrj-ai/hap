import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "ResumeTruth — Resume Authenticity Score",
  description:
    "在 LinkedIn / Greenhouse / Lever 候选人页面上实时显示三维评分：真实度 / 可验证度 / 推荐面试度。",
  version: "0.1.0",
  action: {
    default_popup: "src/popup/index.html",
    default_title: "ResumeTruth",
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  permissions: ["storage", "activeTab", "scripting"],
  host_permissions: [
    "https://www.linkedin.com/*",
    "https://*.greenhouse.io/*",
    "https://*.lever.co/*",
    "https://*.ashbyhq.com/*",
    "http://localhost:3000/*",
    "https://api.resumetruth.com/*",
  ],
  content_scripts: [
    {
      matches: ["https://www.linkedin.com/in/*"],
      js: ["src/content/linkedin.ts"],
      run_at: "document_idle",
    },
  ],
  icons: {
    16: "icons/icon-16.png",
    48: "icons/icon-48.png",
    128: "icons/icon-128.png",
  },
});
