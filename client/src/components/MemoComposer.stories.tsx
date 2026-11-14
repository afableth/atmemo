import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { MemoComposer } from "./MemoComposer";
const meta = {
  title: "Components/MemoComposer",
  component: MemoComposer,
  tags: ["autodocs"],
  args: { onSave: fn(async () => {}) },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 680, margin: "32px auto", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MemoComposer>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Empty: Story = {};
export const Editing: Story = {
  args: {
    editing: true,
    initialBody: "**楽しみにしていること**\n- [ ] 本を読む\n\n#暮らし",
    onCancel: fn(),
  },
};
export const Saving: Story = {
  args: {
    initialBody: "保存中のメモ",
    onSave: fn(() => new Promise<void>(() => {})),
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "メモを保存" }),
    );
  },
};
export const SaveError: Story = {
  args: {
    initialBody: "大切なメモ",
    onSave: fn(async () => {
      throw new Error("保存できませんでした。もう一度お試しください。");
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "メモを保存" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "保存できませんでした",
    );
    await expect(
      canvas.getByRole("textbox", { name: "メモの本文" }),
    ).toHaveValue("大切なメモ");
  },
};
export const Preview: Story = {
  args: { initialBody: "**大切なこと**\n- [x] 記録する\n\n#アイデア" },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "プレビュー" }),
    );
  },
};
