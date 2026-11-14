import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { MemoBody } from "./MemoBody";
const meta = {
  title: "Components/MemoBody",
  component: MemoBody,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div
        style={{
          background: "white",
          padding: 24,
          maxWidth: 680,
          margin: "24px auto",
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MemoBody>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Markdown: Story = {
  args: {
    body: "# 今日のメモ\n## ひらめき\n**大切な言葉**と `コード`。\n\n- 自由に書く\n- あとで振り返る\n\n- [ ] 本を読む\n- [x] メモを残す\n\n#日々のこと #アイデア",
  },
};
export const Html: Story = {
  args: {
    body: "<details><summary>詳細</summary><p>HTMLの本文</p></details>\n\n| 名前 | 状態 |\n| --- | --- |\n| メモ | 完了 |\n\n~~取り消し線~~",
  },
};
export const SanitizedHtml: Story = {
  args: {
    body: '<script>alert(1)</script>\n\n<img onerror="alert(1)">\n\n<a href="javascript:alert(1)">危険なリンク</a>\n\n<svg onload="alert(1)"></svg>\n\n<p style="color:red" onclick="alert(1)">本文</p>\n\n<a id="location" name="document">名前</a>',
  },
  play: async ({ canvasElement }) => {
    const body = canvasElement.querySelector(".memo-body")!;
    await expect(within(body as HTMLElement).getByText("本文")).toBeVisible();
    await expect(
      body.querySelector(
        "script, iframe, svg, [onerror], [onload], [onclick], [style]",
      ),
    ).toBeNull();
    await expect(
      within(body as HTMLElement).getByText("危険なリンク"),
    ).not.toHaveAttribute("href");
    await expect(body.querySelector('#location, [name="document"]')).toBeNull();
  },
};
