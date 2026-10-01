// Header search box (assets/js/site-search.js).
export default {
  ja: {
    results: "検索結果",
    kind: { tool: "ツール", workflow: "ワークフロー" },
    noResults: "見つかりませんでした。",
    browseAll: "ツール一覧から探す",
    count: n => `${n}件の候補があります。上下キーで選択できます。`
  },
  en: {
    results: "Search results",
    kind: { tool: "Tool", workflow: "Workflow" },
    noResults: "No matches found.",
    browseAll: "Browse all tools",
    count: n => `${n} suggestion${n === 1 ? "" : "s"}. Use the up and down keys to choose.`
  }
};
