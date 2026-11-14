import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

export const remarkPlugins = [remarkGfm];
// HTMLを解析してから、最後にデフォルトの許可リストでサニタイズする。
// この後にHTMLや属性を書き換えるプラグインを追加しないこと。
export const rehypePlugins = [rehypeRaw, rehypeSanitize];
