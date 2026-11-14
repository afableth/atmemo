import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, fn, userEvent, within } from "storybook/test";
import { EncryptionPasswordDialog } from "./EncryptionPasswordDialog";

const meta = {
  title: "Components/EncryptionPasswordDialog",
  component: EncryptionPasswordDialog,
  args: {
    onSubmit: fn(async (_password: string) => {}),
    onCancel: fn(async () => {}),
  },
} satisfies Meta<typeof EncryptionPasswordDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dialog = await canvas.findByRole("dialog", {
      name: "暗号化パスワード",
    });
    await expect(dialog).toHaveAccessibleDescription(
      "メモの暗号化・復号に使うパスワードを入力してください。",
    );
    await expect(
      canvas.getByLabelText("暗号化パスワード", { selector: "input" }),
    ).toHaveFocus();
    await expect(canvas.getByRole("button", { name: "続ける" })).toBeDisabled();
  },
};
export const Submit: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText("暗号化パスワード", {
      selector: "input",
    });
    await userEvent.type(input, "  暗号化パスワード  ");
    await expect(input).toHaveAttribute("type", "password");
    await userEvent.click(canvas.getByRole("button", { name: "続ける" }));
    await expect(args.onSubmit).toHaveBeenCalledWith("  暗号化パスワード  ");
    await expect(input).toHaveValue("");
  },
};
export const StorageError: Story = {
  args: {
    onSubmit: fn(async (_password: string): Promise<void> => {
      throw new Error("暗号化パスワードを保存できませんでした。");
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText("暗号化パスワード", {
      selector: "input",
    });
    await userEvent.type(input, "入力を保持する");
    await userEvent.click(canvas.getByRole("button", { name: "続ける" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "暗号化パスワードを保存できませんでした。",
    );
    await expect(input).toHaveValue("入力を保持する");
  },
};
export const Pending: Story = {
  args: { onSubmit: fn((_password: string) => new Promise<void>(() => {})) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByLabelText("暗号化パスワード", { selector: "input" }),
      "暗号化パスワード",
    );
    await userEvent.click(canvas.getByRole("button", { name: "続ける" }));
    await expect(
      canvas.getByRole("button", { name: "設定中…" }),
    ).toBeDisabled();
    await expect(
      canvas.getByRole("button", { name: "ログアウト" }),
    ).toBeDisabled();
  },
};
export const Logout: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "ログアウト" }),
    );
    await expect(args.onCancel).toHaveBeenCalledOnce();
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};
export const Escape: Story = {
  play: async ({ canvasElement, args }) => {
    const dialog = await within(canvasElement).findByRole("dialog");
    fireEvent(
      dialog,
      new Event("cancel", { bubbles: false, cancelable: true }),
    );
    await expect(args.onCancel).toHaveBeenCalledOnce();
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};
