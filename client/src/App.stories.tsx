import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { MemoApp } from "./App";
import { createStoryRepository } from "../.storybook/fixtures/memos";
import type { MemoRepository } from "./api/memos";
function Demo({
  mode = "default",
}: {
  mode?:
    | "default"
    | "empty"
    | "loading"
    | "error"
    | "body-error"
    | "readonly"
    | "pagination"
    | "page-error"
    | "empty-content";
}) {
  const [repository] = useState<MemoRepository>(() => {
    const repo = createStoryRepository({
      repeat: mode === "pagination" ? 5 : 1,
    });
    if (mode === "empty") return { ...repo, list: async () => ({ items: [] }) };
    if (mode === "loading")
      return { ...repo, list: () => new Promise(() => {}) };
    if (mode === "error")
      return {
        ...repo,
        list: async () => {
          throw new Error("接続を確認して、もう一度お試しください。");
        },
      };
    if (mode === "body-error")
      return {
        ...repo,
        list: async (cursor) => {
          const page = await repo.list(cursor);
          return {
            ...page,
            items: page.items.map((memo) => ({
              ...memo,
              getContent: async () => {
                throw new Error("本文を取得できませんでした。");
              },
            })),
          };
        },
      };
    if (mode === "readonly") return { list: repo.list };
    if (mode === "page-error") {
      let fail = true;
      return {
        ...repo,
        list: async (cursor) => {
          if (cursor && fail) {
            fail = false;
            throw new Error("追加のメモを取得できませんでした。");
          }
          return repo.list(cursor);
        },
      };
    }
    if (mode === "empty-content")
      return {
        ...repo,
        list: async (cursor) => {
          const page = await repo.list(cursor);
          return {
            ...page,
            items: page.items.map((memo) => ({
              ...memo,
              getContent: async () => "",
            })),
          };
        },
      };
    return repo;
  });
  return <MemoApp repository={repository} />;
}
const meta = {
  title: "Pages/MemoApp",
  component: Demo,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { mode: "empty" } };
export const Loading: Story = { args: { mode: "loading" } };
export const ListError: Story = { args: { mode: "error" } };
export const BodyError: Story = { args: { mode: "body-error" } };
export const ReadOnly: Story = { args: { mode: "readonly" } };
export const Mobile: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
  parameters: {
    viewport: {
      options: {
        mobile1: {
          name: "Mobile",
          styles: { width: "390px", height: "844px" },
          type: "mobile",
        },
      },
    },
  },
};
export const CreateEditDelete: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const composer = canvas.getByRole("form", { name: "新しいメモ" });
    await userEvent.type(
      within(composer).getByRole("textbox", { name: "メモの本文" }),
      "忘れないように書き留める。",
    );
    await userEvent.click(
      within(composer).getByRole("button", { name: "メモを保存" }),
    );
    const card = await canvas.findByRole("article", {
      name: "メモ 6",
    });
    card.scrollIntoView();
    await expect(
      await within(card).findByText("忘れないように書き留める。"),
    ).toBeVisible();
    await userEvent.click(within(card).getByRole("button", { name: "編集" }));
    const editor = within(card).getByRole("textbox", { name: "メモの本文" });
    await userEvent.clear(editor);
    await userEvent.type(editor, "編集した本文。");
    await userEvent.click(
      within(card).getByRole("button", { name: "変更を保存" }),
    );
    const updated = await canvas.findByRole("article", {
      name: "メモ 6",
    });
    updated.scrollIntoView();
    await expect(
      await within(updated).findByText("編集した本文。"),
    ).toBeVisible();
    await userEvent.click(
      within(updated).getByRole("button", { name: "削除" }),
    );
    await userEvent.click(
      within(updated).getByRole("button", { name: "削除する" }),
    );
    await waitFor(() =>
      expect(
        canvas.queryByRole("article", { name: "メモ 6" }),
      ).not.toBeInTheDocument(),
    );
  },
};

export const EmptyContent: Story = { args: { mode: "empty-content" } };
export const Pagination: Story = {
  args: { mode: "pagination" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("article", { name: "メモ 1" });
    for (let count = 0; count < 9; count++) {
      canvasElement.querySelector(".pagination-sentinel")?.scrollIntoView();
      await waitFor(() =>
        expect(canvas.getAllByRole("article").length).toBeGreaterThan(
          Math.min(count * 3, 24),
        ),
      );
    }
    await canvas.findByRole("article", { name: "メモ 25" });
    await expect(canvas.getAllByRole("article")).toHaveLength(25);
  },
};
export const PageError: Story = {
  args: { mode: "page-error" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("article", { name: "メモ 1" });
    canvasElement.querySelector(".pagination-sentinel")?.scrollIntoView();
    const alert = await canvas.findByRole("alert");
    await expect(canvas.getAllByRole("article")).toHaveLength(3);
    await userEvent.click(
      within(alert).getByRole("button", { name: "再試行" }),
    );
    await canvas.findByRole("article", { name: "メモ 5" });
    await expect(canvas.getAllByRole("article")).toHaveLength(5);
  },
};
