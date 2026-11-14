import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { LoginForm } from "./LoginForm";

const meta = {
  title: "Components/LoginForm",
  component: LoginForm,
  args: {
    onSignIn: fn(async (_identifier: string) => {}),
    onPassport: fn(async () => {}),
  },
} satisfies Meta<typeof LoginForm>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Error: Story = { args: { error: "ログインできませんでした。" } };
export const SignIn: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByRole("textbox", { name: "ハンドル" }),
      "alice.example",
    );
    await userEvent.click(canvas.getByRole("button", { name: "ログイン" }));
    await expect(args.onSignIn).toHaveBeenCalledWith("alice.example");
  },
};
export const Passport: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", {
        name: "@passportでログイン",
      }),
    );
    await expect(args.onPassport).toHaveBeenCalled();
  },
};
